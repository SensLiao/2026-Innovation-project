/**
 * DiagnosisService - 诊断记录持久化服务
 *
 * 职责：
 * - 创建/更新诊断记录 (含临床上下文)
 * - 保存对话历史
 * - 管理医生-病人关联
 * - 获取病人信息用于报告生成
 *
 * 临床上下文字段 (iter4):
 * - clinical_indication: 检查原因
 * - smoking_history: 吸烟史 (JSONB)
 * - relevant_history: 相关病史
 * - prior_imaging_date: 既往影像日期
 * - exam_type: 检查类型
 * - exam_date: 检查日期
 *
 * 注意：目前连接 dev 分支，生产环境需切换连接字符串
 */

import { neon } from '@neondatabase/serverless';

// 根据环境选择数据库
const isDev = process.env.NODE_ENV !== 'production';
const DEV_DB = 'postgresql://neondb_owner:npg_JmAYfQy70rIF@ep-hidden-field-a7ucgm04-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const MAIN_DB = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}/${process.env.PGDATABASE}?sslmode=require`;

// 使用 dev 分支进行开发测试
const sql = neon(DEV_DB);

class DiagnosisService {
  constructor() {
    this.tableName = 'diagnosis_records';
  }

  /**
   * 创建新的诊断记录 (含临床上下文)
   * @param {Object} data - 诊断数据
   * @param {number} data.patientId - 病人 ID
   * @param {number} data.doctorId - 医生 ID
   * @param {number} data.segmentationId - 分割记录 ID
   * @param {string} data.status - 状态
   * @param {Object} data.clinicalContext - 临床上下文
   * @returns {number} - 新记录的 ID
   */
  async createDiagnosis(data) {
    const {
      patientId = null,
      doctorId = null,
      segmentationId = null,
      status = 'CREATED',
      clinicalContext = {}
    } = data;

    // 解构临床上下文
    const {
      clinicalIndication = null,
      smokingHistory = null,
      relevantHistory = null,
      priorImagingDate = null,
      examType = null,
      examDate = null
    } = clinicalContext;

    try {
      const result = await sql`
        INSERT INTO diagnosis_records (
          patient_id,
          doctor_id,
          segmentation_id,
          status,
          clinical_indication,
          smoking_history,
          relevant_history,
          prior_imaging_date,
          exam_type,
          exam_date
        )
        VALUES (
          ${patientId},
          ${doctorId},
          ${segmentationId},
          ${status},
          ${clinicalIndication},
          ${smokingHistory ? JSON.stringify(smokingHistory) : '{}'}::jsonb,
          ${relevantHistory},
          ${priorImagingDate},
          ${examType},
          ${examDate || sql`CURRENT_DATE`}
        )
        RETURNING id
      `;
      console.log(`[DiagnosisService] Created diagnosis ID: ${result[0].id}`);
      return result[0].id;
    } catch (error) {
      console.error('[DiagnosisService] Create error:', error.message);
      throw error;
    }
  }

  /**
   * 更新诊断报告内容
   * @param {number} diagnosisId - 诊断 ID
   * @param {Object} data - 更新数据
   */
  async updateDiagnosis(diagnosisId, data) {
    const {
      reportContent = null,
      reportPatient = null,
      status = null,
      icdCodes = null
    } = data;

    try {
      const updates = [];
      const values = [];

      if (reportContent !== null) {
        updates.push('report_content = $' + (values.length + 1));
        values.push(reportContent);
      }
      if (reportPatient !== null) {
        updates.push('report_patient = $' + (values.length + 1));
        values.push(reportPatient);
      }
      if (status !== null) {
        updates.push('status = $' + (values.length + 1));
        values.push(status);
      }
      if (icdCodes !== null) {
        updates.push('icd_codes = $' + (values.length + 1));
        values.push(JSON.stringify(icdCodes));
      }

      if (updates.length === 0) return;

      // Simple update without dynamic SQL (Neon limitation)
      await sql`
        UPDATE diagnosis_records
        SET
          report_content = COALESCE(${reportContent}, report_content),
          report_patient = COALESCE(${reportPatient}, report_patient),
          status = COALESCE(${status}, status),
          icd_codes = COALESCE(${icdCodes ? JSON.stringify(icdCodes) : null}::jsonb, icd_codes),
          updated_at = NOW()
        WHERE id = ${diagnosisId}
      `;

      console.log(`[DiagnosisService] Updated diagnosis ID: ${diagnosisId}`);
    } catch (error) {
      console.error('[DiagnosisService] Update error:', error.message);
      throw error;
    }
  }

  /**
   * 获取诊断记录
   * @param {number} diagnosisId - 诊断 ID
   */
  async getDiagnosis(diagnosisId) {
    try {
      const result = await sql`
        SELECT * FROM diagnosis_records WHERE id = ${diagnosisId}
      `;
      return result[0] || null;
    } catch (error) {
      console.error('[DiagnosisService] Get error:', error.message);
      return null;
    }
  }

  /**
   * 保存对话消息
   * @param {Object} message - 消息数据
   */
  async saveChatMessage(message) {
    const {
      diagnosisId,
      role,
      agentName = null,
      content,
      feedbackType = null
    } = message;

    try {
      const result = await sql`
        INSERT INTO chat_history (diagnosis_id, role, agent_name, content, feedback_type)
        VALUES (${diagnosisId}, ${role}, ${agentName}, ${content}, ${feedbackType})
        RETURNING id
      `;
      return result[0].id;
    } catch (error) {
      console.error('[DiagnosisService] Save message error:', error.message);
      // Don't throw - chat persistence is non-critical
      return null;
    }
  }

  /**
   * 批量保存对话消息
   * @param {number} diagnosisId - 诊断 ID
   * @param {Array} messages - 消息数组
   */
  async saveChatMessages(diagnosisId, messages) {
    const savedIds = [];
    for (const msg of messages) {
      const id = await this.saveChatMessage({
        diagnosisId,
        role: msg.role,
        agentName: msg.agentName || msg.agent_name,
        content: msg.content,
        feedbackType: msg.feedbackType || msg.feedback_type
      });
      if (id) savedIds.push(id);
    }
    return savedIds;
  }

  /**
   * 获取诊断的对话历史
   * @param {number} diagnosisId - 诊断 ID
   */
  async getChatHistory(diagnosisId) {
    try {
      const result = await sql`
        SELECT * FROM chat_history
        WHERE diagnosis_id = ${diagnosisId}
        ORDER BY created_at ASC
      `;
      return result;
    } catch (error) {
      console.error('[DiagnosisService] Get history error:', error.message);
      return [];
    }
  }

  /**
   * 创建医生-病人关联
   * @param {number} doctorId - 医生 ID
   * @param {number} patientId - 病人 ID
   */
  async assignPatientToDoctor(doctorId, patientId) {
    try {
      await sql`
        INSERT INTO doctor_patient (doctor_id, patient_id)
        VALUES (${doctorId}, ${patientId})
        ON CONFLICT (doctor_id, patient_id) DO NOTHING
      `;
      return true;
    } catch (error) {
      console.error('[DiagnosisService] Assign error:', error.message);
      return false;
    }
  }

  /**
   * 获取医生的所有病人
   * @param {number} doctorId - 医生 ID
   */
  async getDoctorPatients(doctorId) {
    try {
      const result = await sql`
        SELECT p.* FROM patients p
        JOIN doctor_patient dp ON p.pid = dp.patient_id
        WHERE dp.doctor_id = ${doctorId}
        ORDER BY dp.assigned_at DESC
      `;
      return result;
    } catch (error) {
      console.error('[DiagnosisService] Get patients error:', error.message);
      return [];
    }
  }

  /**
   * 获取病人的所有诊断记录
   * @param {number} patientId - 病人 ID
   */
  async getPatientDiagnoses(patientId) {
    try {
      const result = await sql`
        SELECT dr.*, u.name as doctor_name
        FROM diagnosis_records dr
        LEFT JOIN users u ON dr.doctor_id = u.uid
        WHERE dr.patient_id = ${patientId}
        ORDER BY dr.created_at DESC
      `;
      return result;
    } catch (error) {
      console.error('[DiagnosisService] Get diagnoses error:', error.message);
      return [];
    }
  }

  /**
   * 删除诊断记录（级联删除对话历史）
   * @param {number} diagnosisId - 诊断 ID
   */
  async deleteDiagnosis(diagnosisId) {
    try {
      await sql`DELETE FROM diagnosis_records WHERE id = ${diagnosisId}`;
      return true;
    } catch (error) {
      console.error('[DiagnosisService] Delete error:', error.message);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // iter4: Patient Info & Clinical Context Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取病人信息
   * @param {number} patientId - 病人 ID
   * @returns {Object|null} - 病人信息
   */
  async getPatient(patientId) {
    try {
      const result = await sql`
        SELECT pid, name, age, gender, dateofbirth, mrn, phone, email
        FROM patients
        WHERE pid = ${patientId}
      `;
      return result[0] || null;
    } catch (error) {
      console.error('[DiagnosisService] Get patient error:', error.message);
      return null;
    }
  }

  /**
   * 获取诊断记录及关联的病人信息 (用于报告生成)
   * @param {number} diagnosisId - 诊断 ID
   * @returns {Object|null} - 完整诊断信息 (含病人和临床上下文)
   */
  async getDiagnosisWithPatient(diagnosisId) {
    try {
      const result = await sql`
        SELECT
          dr.*,
          p.name as patient_name,
          p.age as patient_age,
          p.gender as patient_gender,
          p.dateofbirth as patient_dob,
          p.mrn as patient_mrn,
          u.name as doctor_name
        FROM diagnosis_records dr
        LEFT JOIN patients p ON dr.patient_id = p.pid
        LEFT JOIN users u ON dr.doctor_id = u.uid
        WHERE dr.id = ${diagnosisId}
      `;

      if (result.length === 0) return null;

      const row = result[0];

      // 格式化返回数据
      return {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,

        // 病人信息 (用于报告头部)
        patientInfo: {
          id: row.patient_id,
          name: row.patient_name,
          age: row.patient_age,
          gender: row.patient_gender,
          dob: row.patient_dob,
          mrn: row.patient_mrn
        },

        // 医生信息
        doctorInfo: {
          id: row.doctor_id,
          name: row.doctor_name
        },

        // 临床上下文 (用于 AI 分析)
        clinicalContext: {
          clinicalIndication: row.clinical_indication,
          smokingHistory: row.smoking_history,
          relevantHistory: row.relevant_history,
          priorImagingDate: row.prior_imaging_date,
          examType: row.exam_type,
          examDate: row.exam_date
        },

        // 报告内容
        reportContent: row.report_content,
        reportPatient: row.report_patient,
        icdCodes: row.icd_codes
      };
    } catch (error) {
      console.error('[DiagnosisService] Get diagnosis with patient error:', error.message);
      return null;
    }
  }

  /**
   * 搜索病人 (支持按姓名或 MRN 搜索)
   * @param {string} query - 搜索关键词
   * @returns {Array} - 匹配的病人列表
   */
  async searchPatients(query) {
    try {
      // Sanitize: escape LIKE special characters to prevent SQL injection
      const sanitized = query.replace(/[%_\\]/g, '\\$&');
      const searchTerm = `%${sanitized}%`;
      const result = await sql`
        SELECT pid, name, age, gender, mrn
        FROM patients
        WHERE name ILIKE ${searchTerm} OR mrn ILIKE ${searchTerm}
        ORDER BY name
        LIMIT 10
      `;
      return result;
    } catch (error) {
      console.error('[DiagnosisService] Search patients error:', error.message);
      return [];
    }
  }

  /**
   * 获取所有病人列表 (用于下拉选择)
   * @returns {Array} - 病人列表
   */
  async getAllPatients() {
    try {
      const result = await sql`
        SELECT pid, name, age, gender, mrn
        FROM patients
        ORDER BY name
      `;
      return result;
    } catch (error) {
      console.error('[DiagnosisService] Get all patients error:', error.message);
      return [];
    }
  }

  /**
   * 获取病人最新的诊断记录 (用于自动填充临床上下文)
   * @param {number} patientId - 病人 ID
   * @returns {Object|null} - 最新诊断记录
   */
  async getLatestDiagnosisByPatient(patientId) {
    try {
      const result = await sql`
        SELECT
          dr.*,
          p.name as patient_name,
          p.mrn as patient_mrn
        FROM diagnosis_records dr
        LEFT JOIN patients p ON dr.patient_id = p.pid
        WHERE dr.patient_id = ${patientId}
        ORDER BY dr.created_at DESC
        LIMIT 1
      `;

      if (result.length === 0) return null;

      const row = result[0];
      return {
        id: row.id,
        status: row.status,
        clinicalContext: {
          clinicalIndication: row.clinical_indication,
          examType: row.exam_type,
          examDate: row.exam_date,
          smokingHistory: row.smoking_history,
          relevantHistory: row.relevant_history,
          priorImagingDate: row.prior_imaging_date
        }
      };
    } catch (error) {
      console.error('[DiagnosisService] Get latest diagnosis error:', error.message);
      return null;
    }
  }

  /**
   * 获取所有报告列表 (带患者信息)
   * @returns {Array} - 报告列表
   */
  async getAllReports() {
    try {
      const result = await sql`
        SELECT
          d.id,
          d.patient_id,
          d.status,
          d.report_content,
          d.created_at,
          d.updated_at,
          p.name as patient_name,
          p.pid as patient_pid,
          p.mrn as patient_mrn
        FROM diagnosis_records d
        LEFT JOIN patients p ON d.patient_id = p.pid
        WHERE d.report_content IS NOT NULL
        ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC
      `;
      // 转换为 camelCase 格式，解析 JSON content
      return result.map(row => {
        let content = row.report_content;
        // Parse JSON content if it has {version, content} structure
        if (content && typeof content === 'string') {
          try {
            const parsed = JSON.parse(content);
            if (parsed.content) {
              content = parsed.content;
            }
          } catch (e) {
            // Not JSON, keep as-is
          }
        }
        return {
          id: row.id,
          patientId: row.patient_id,
          status: row.status,
          content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          patientName: row.patient_name,
          patientPid: row.patient_pid,
          patientMrn: row.patient_mrn
        };
      });
    } catch (error) {
      console.error('[DiagnosisService] Get all reports error:', error.message);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Version History Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取版本历史
   * @param {number} diagnosisId - 诊断 ID
   * @returns {Array} - 版本列表
   */
  async getVersionHistory(diagnosisId) {
    try {
      const result = await sql`
        SELECT
          id,
          diagnosis_id,
          version_number,
          content,
          change_type,
          change_source,
          agent_name,
          feedback_message,
          created_at
        FROM report_versions
        WHERE diagnosis_id = ${diagnosisId}
        ORDER BY version_number DESC
      `;
      return result.map(row => ({
        id: row.id,
        diagnosisId: row.diagnosis_id,
        versionNumber: row.version_number,
        content: row.content,
        changeType: row.change_type,
        changeSource: row.change_source,
        agentName: row.agent_name,
        feedbackMessage: row.feedback_message,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('[DiagnosisService] Get version history error:', error.message);
      return [];
    }
  }

  /**
   * 保存新版本
   * @param {number} diagnosisId - 诊断 ID
   * @param {string} content - 报告内容
   * @param {Object} options - 选项
   * @returns {Object|null} - 新版本信息
   */
  async saveVersion(diagnosisId, content, options = {}) {
    const {
      changeType = 'user_save',
      changeSource = 'user',
      agentName = null,
      feedbackMessage = null
    } = options;

    try {
      // 获取下一个版本号
      const maxResult = await sql`
        SELECT COALESCE(MAX(version_number), 0) as max_version
        FROM report_versions
        WHERE diagnosis_id = ${diagnosisId}
      `;
      const nextVersion = (maxResult[0]?.max_version || 0) + 1;

      // 插入新版本
      const result = await sql`
        INSERT INTO report_versions (
          diagnosis_id,
          version_number,
          content,
          change_type,
          change_source,
          agent_name,
          feedback_message
        )
        VALUES (
          ${diagnosisId},
          ${nextVersion},
          ${content},
          ${changeType},
          ${changeSource},
          ${agentName},
          ${feedbackMessage}
        )
        RETURNING *
      `;

      const row = result[0];
      console.log(`[DiagnosisService] Saved version ${nextVersion} for diagnosis ${diagnosisId}`);

      return {
        id: row.id,
        diagnosisId: row.diagnosis_id,
        versionNumber: row.version_number,
        content: row.content,
        changeType: row.change_type,
        changeSource: row.change_source,
        agentName: row.agent_name,
        feedbackMessage: row.feedback_message,
        createdAt: row.created_at
      };
    } catch (error) {
      console.error('[DiagnosisService] Save version error:', error.message);
      return null;
    }
  }

  /**
   * 获取特定版本
   * @param {number} diagnosisId - 诊断 ID
   * @param {number} versionNumber - 版本号
   * @returns {Object|null} - 版本信息
   */
  async getVersion(diagnosisId, versionNumber) {
    try {
      const result = await sql`
        SELECT *
        FROM report_versions
        WHERE diagnosis_id = ${diagnosisId}
          AND version_number = ${versionNumber}
      `;

      if (result.length === 0) return null;

      const row = result[0];
      return {
        id: row.id,
        diagnosisId: row.diagnosis_id,
        versionNumber: row.version_number,
        content: row.content,
        changeType: row.change_type,
        changeSource: row.change_source,
        agentName: row.agent_name,
        feedbackMessage: row.feedback_message,
        createdAt: row.created_at
      };
    } catch (error) {
      console.error('[DiagnosisService] Get version error:', error.message);
      return null;
    }
  }
}

// 导出单例
export const diagnosisService = new DiagnosisService();
export default diagnosisService;
