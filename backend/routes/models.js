
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';
import fs from 'fs';
import axios from 'axios';

import globals from '../globals.js';

const router = express.Router();

// 2. Variables initialization
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 3. Load Image as tensor
async function loadImageAsTensor(imageBuffer) {
  // Step 1: 使用 sharp 读取 Buffer，获取原始像素数据（HWC, Uint8）
  const { data, info } = await sharp(imageBuffer).raw().toBuffer({ resolveWithObject: true });

  console.log('Channels:', info.channels);
  const height = info.height;
  const width = info.width;

  // Step 2: 转成 float32，保留 [0, 255] 值域
  const floatData = Float32Array.from(data);

  // Step 3: 构造 ONNX 输入 Tensor (H, W, 3)
  const tensor = new ort.Tensor('float32', floatData, [height, width, 3]);

  console.log('✅ 测试图片转换为 Tensor 成功！');
  return tensor;
}

// 4. image encoder running
async function runImageEncoder(imageTensor, encoder) {
  // Step 1: 执行推理
  const feeds = { input_image: imageTensor };
  const results = await encoder.run(feeds);

  // Step 2: 获取输出结果
  const embedding = results.image_embeddings;

  // Step3: 打印输出结果
  console.log('✅ image encoder 推理成功！');
  console.log('输出维度:', embedding.dims);

  return embedding; // 返回输出结果
}

// 5. Image decoder running
async function runImageDecoder(feeds, decoder) {
  const results = await decoder.run(feeds);
  // results : {"masks", "iou_predictions", "low_res_masks"}
  const masks = results.masks;
  const iou_predictions = results.iou_predictions;
  const low_res_masks = results.low_res_masks;
  console.log('✅ image decoder 推理成功！');

  return { masks, iou_predictions, low_res_masks };
}

// 6. Convert normalArray to float32Array
function convertToTensor(normalArray, dims) {
  const float32Array = new Float32Array(normalArray);
  const tensor = new ort.Tensor('float32', float32Array, dims);
  return tensor;
}

// 7.Image encoder route
router.post('/load_model', upload.single('image'), async (req, res) => {
  try {
    //1. get the image file from the frontend
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    } else {
      console.log('✅ 收到图片:', file.originalname, file.mimetype, file.size);
    }

    //2.load the ONNX image encoder model
    const encoder = globals.onnxModels.encoder;

    //3. convert the image to tensor
    const imageTensor = await loadImageAsTensor(file.buffer);
    console.log('✅ 图片转换为 Tensor 成功！');

    //4. run the image encoder
    const image_embeddings = await runImageEncoder(imageTensor, encoder);
    console.log('✅ 图片embedding 成功！');
    return res.status(200).json({
      message: 'Image embeddings generated successfully',
      image_embeddings: Array.from(image_embeddings.data),
      embedding_dims: image_embeddings.dims
    });
  } catch (error) {
    console.error('❌ Error loading model:', error);
    return res.status(500).json({ error: 'Failed to output the image embedding' });
  }
});

// 8.Image decoder route
router.post('/run_model', async (req, res) => {
  try {
    let {
      image_embeddings,   // float[] (flatten)
      embedding_dims,     // e.g. [1, 256, 64, 64]
      point_coords,       // e.g. [[x,y], ...] (像素坐标)
      point_labels,       // e.g. [1, 0, ...]
      mask_input,         // optional: float[] (1*1*lowRes*lowRes)
      has_mask_input,     // optional: [0] or [1]
      orig_im_size        // [H, W]
    } = req.body;

    if (!image_embeddings || !embedding_dims) {
      return res.status(400).json({ error: 'Image embeddings not generated yet' });
    }

    const decoder = globals.onnxModels.decoder;
    if (!decoder) {
      return res.status(500).json({ error: 'Image decoder model not loaded' });
    }

    // ---- helpers（只在此路由内用）----
    const getTargetLength = (embeddingDims) => {
      // SAM/MedSAM：grid * 16
      const grid = embeddingDims[2];
      return grid * 16;
    };

    const applyCoordsToTarget = (points, origH, origW, targetLength) => {
      const scale = targetLength / Math.max(origH, origW);
      const newH = Math.round(origH * scale);
      const newW = Math.round(origW * scale);
      return points.map(([x, y]) => [
        x * (newW / origW),
        y * (newH / origH)
      ]);
    };

    const logitsTo01Flat = (arr) => {
      const out = new Uint8Array(arr.length);
      for (let i = 0; i < arr.length; i++) out[i] = arr[i] > 0 ? 1 : 0;
      return out;
    };

    // 0) 原图尺寸
    let [origH, origW] = Array.isArray(orig_im_size) ? orig_im_size : [0, 0];
    origH = Number(origH);
    origW = Number(origW);

    // 1) 由 embedding_dims 推回 targetLength / lowRes
    const targetLength = getTargetLength(embedding_dims); // 常见 1024 或 256
    const lowRes = targetLength / 4;                      // 常见 256 或 64

    console.log('✅ embedding_dims:', embedding_dims, '→ targetLength:', targetLength, 'lowRes:', lowRes);

    // 2) image_embeddings
    const embTensor = new ort.Tensor('float32', Float32Array.from(image_embeddings), embedding_dims);

    // 3) points + labels：坐标映射 + padding 点
    const pts = Array.isArray(point_coords) ? point_coords : [];
    const lbs = Array.isArray(point_labels) ? point_labels : [];

    const mapped = applyCoordsToTarget(pts, origH, origW, targetLength);
    // 追加 padding 点 (0,0), label = -1（无 box 时建议总补）
    mapped.push([0.0, 0.0]);
    lbs.push(-1);

    const numPts = mapped.length;
    const coordsTensor = new ort.Tensor('float32', Float32Array.from(mapped.flat()), [1, numPts, 2]);
    const labelsTensor = new ort.Tensor('float32', Float32Array.from(lbs), [1, numPts]);

    // 4) mask_input / has_mask_input：尺寸动态匹配 lowRes
    const expectedLen = 1 * 1 * lowRes * lowRes;
    let maskTensor, hasMaskTensor;

    if (mask_input && mask_input.length === expectedLen) {
      maskTensor = new ort.Tensor('float32', Float32Array.from(mask_input), [1, 1, lowRes, lowRes]);
      if (has_mask_input && has_mask_input.length === 1) {
        hasMaskTensor = new ort.Tensor('float32', Float32Array.from(has_mask_input), [1]);
      } else {
        const anyNonZero = mask_input.some((v) => v !== 0);
        hasMaskTensor = new ort.Tensor('float32', Float32Array.from([anyNonZero ? 1 : 0]), [1]);
      }
    } else {
      maskTensor = new ort.Tensor('float32', new Float32Array(expectedLen), [1, 1, lowRes, lowRes]); // 全零
      hasMaskTensor = new ort.Tensor('float32', Float32Array.from([0]), [1]);
    }

    // 5) orig_im_size
    const sizeTensor = new ort.Tensor('float32', Float32Array.from([origH, origW]), [2]);

    const feeds = {
      image_embeddings: embTensor,
      point_coords: coordsTensor,
      point_labels: labelsTensor,
      mask_input: maskTensor,
      has_mask_input: hasMaskTensor,
      orig_im_size: sizeTensor
    };
    const { masks, iou_predictions, low_res_masks } = await runImageDecoder(feeds, decoder);

    console.log('Mask shape:', masks.dims); // 典型 [1,1,H,W]
    console.log('Low-res masks shape:', low_res_masks.dims); // 典型 [1,1,lowRes,lowRes]
    console.log('IOU predictions:', Array.from(iou_predictions.data));

    // 6) 直接 logits > 0
    const final_mask = Array.from(logitsTo01Flat(Array.from(masks.data)));

    return res.status(200).json({
      message: 'Image decoder ran successfully',
      masks: final_mask,
      masks_shape: masks.dims,
      iou_predictions: Array.from(iou_predictions.data),
      iou_shape: iou_predictions.dims,
      low_res_masks: Array.from(low_res_masks.data),
      low_res_masks_shape: low_res_masks.dims
    });
  } catch (error) {
    console.error('❌ Error running model:', error);
    return res.status(500).json({ error: 'Failed to run the image decoder' });
  }
});

// ============================================================
// N8N ROUTES - COMMENTED OUT (replaced by agentRoute.js)
// ============================================================
// 9. Medical Analysis router -- n8n version (deprecated)
// router.post('/medical_report_init', async (req, res) => {
//   try {
//     const { final_image } = req.body;
//     if (!final_image) {
//       return res.status(400).json({ error: 'No final image provided' });
//     }
//     const systemPrompt = `...`;  // truncated for brevity
//     const url = 'http://localhost:5678/webhook-test/15f56758-4d20-48e2-aca8-13188bf401d7';
//     const response = await axios.post(url, message, { timeout: 120000 });
//     return res.status(200).json({ message: 'Medical report generated successfully', report: response.data });
//   } catch (error) {
//     return res.status(500).json({ error: 'Failed to generate the medical report' });
//   }
// });

// 10. Report refinement router -- n8n version (deprecated)
// router.post('/medical_report_rein', async (req, res) => {
//   res.status(501).json({ error: 'This feature is not implemented yet' });
// });
// ============================================================

// 11.Testing functions
async function test(fileBuffer) {
  // --- tiny helpers (only for this test) ---
  const getTargetLength = (embeddingDims) => {
    // embeddingDims 形如 [1, 256, G, G]，G*16 就是长边 target_length
    const grid = embeddingDims[2];
    return grid * 16;
  };

  const applyCoordsToTarget = (points, origH, origW, targetLength) => {
    const scale = targetLength / Math.max(origH, origW);
    const newH = Math.round(origH * scale);
    const newW = Math.round(origW * scale);
    return points.map(([x, y]) => [x * (newW / origW), y * (newH / origH)]);
  };

  const logitsTo01Flat = (flat) => {
    const out = new Uint8Array(flat.length);
    for (let i = 0; i < flat.length; i++) out[i] = flat[i] > 0 ? 1 : 0;
    return out;
  };

  const to2D = (flat, h, w) => {
    const rows = [];
    for (let y = 0; y < h; y++) {
      rows.push(Array.from(flat.slice(y * w, (y + 1) * w)));
    }
    return rows;
  };

  // 1) 原图尺寸
  const { width: origW, height: origH } = await sharp(fileBuffer).metadata();

  // 2) 编码器：注意你已用 --use-preprocess，所以直接喂 HWC/0-255 即可
  const imageTensor = await loadImageAsTensor(fileBuffer);
  const embedding = await runImageEncoder(imageTensor, globals.onnxModels.encoder);

  // 3) 由 embedding 维度推回 target_length & low-res 尺寸
  const targetLength = (function getTL(dims) {
    // dims e.g. [1, 256, 64, 64] => targetLength = 64 * 16 = 1024
    const grid = dims[2];
    return grid * 16;
  })(embedding.dims);
  const lowRes = targetLength / 4;

  console.log('🔎 embedding.dims =', embedding.dims, '=> targetLength =', targetLength, 'lowRes =', lowRes);

  // 4) 构造提示：单点 + padding 点
  const rawPoints = [[336, 275]];
  const rawLabels = [1]; // 1=正点
  const mapped = applyCoordsToTarget(rawPoints, origH, origW, targetLength);

  // 追加 padding 点 (0,0), label=-1 以符合解码器约定
  mapped.push([0.0, 0.0]);
  rawLabels.push(-1);

  const numPts = mapped.length;
  const coordsTensor = new ort.Tensor('float32', Float32Array.from(mapped.flat()), [1, numPts, 2]);
  const labelsTensor = new ort.Tensor('float32', Float32Array.from(rawLabels), [1, numPts]);

  // 5) 准备 mask_input（全零）、has_mask_input（0）
  const mask_input = new ort.Tensor('float32', new Float32Array(1 * 1 * lowRes * lowRes), [1, 1, lowRes, lowRes]);
  const has_mask_input = new ort.Tensor('float32', Float32Array.from([0]), [1]);

  // 6) orig_im_size
  const orig_im_size = new ort.Tensor('float32', Float32Array.from([origH, origW]), [2]);

  // 7) 解码器
  const decoder = globals.onnxModels.decoder;
  const feeds = {
    image_embeddings: embedding,
    point_coords: coordsTensor,
    point_labels: labelsTensor,
    mask_input: mask_input,
    has_mask_input: has_mask_input,
    orig_im_size: orig_im_size
  };

  const { masks, iou_predictions, low_res_masks } = await runImageDecoder(feeds, decoder);

  console.log('✅ decoder done. masks shape:', masks.dims, 'low_res_masks shape:', low_res_masks.dims);
  console.log('IOU predictions:', Array.from(iou_predictions.data));

  // 8) logits 直接 > 0 得到 0/1
  const masksFlat01 = logitsTo01Flat(Array.from(masks.data));

  // 9) 用真实维度写入调试文件（不要硬编码 512x512）
  const H = masks.dims[2],
    W = masks.dims[3];
  const masks2D = to2D(masksFlat01, H, W);
  fs.writeFileSync('mask.txt', masks2D.map((row) => row.join(' ')).join('\n'));

  console.log('📝 mask written to mask.txt with shape', H, 'x', W);
}

// ESM 导出（命名导出）
export { router, test };
