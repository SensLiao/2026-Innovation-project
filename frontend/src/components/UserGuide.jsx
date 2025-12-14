import React, { useState, useEffect } from 'react';
import { HelpCircle, X, ArrowRight } from 'lucide-react';

/**
 * UserGuide Component - Interactive Product Tour
 * 
 * Displays an overlay with tooltips pointing to actual page elements
 * Guides users through key features with step-by-step instructions
 */
const UserGuide = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const guideSteps = [
    {
      title: 'Image Upload Area',
      description: 'Click or drag to upload medical images (CT, MRI, X-ray). System auto-detects exam type.',
      target: 'upload-zone', // ID or class to target
      position: 'right', // Tooltip position relative to target
      highlight: true
    },
    {
      title: 'Segmentation Tools',
      description: 'Select foreground/background mode and use point tool to mark regions of interest.',
      target: 'segmentation-tools',
      position: 'bottom',
      highlight: true
    },
    {
      title: 'Patient & Clinical Info',
      description: 'Select patient and fill clinical context. Auto-fills from history when available.',
      target: 'patient-info-section',
      position: 'right',
      highlight: true
    },
    {
      title: 'Mask Management',
      description: 'View and manage segmentation masks. Toggle visibility, delete, or create new layers.',
      target: 'masks-section',
      position: 'right',
      highlight: true
    },
    {
      title: 'AI Chat Assistant',
      description: 'Chat with AI agents for radiology analysis. Click "Analyse" to generate reports automatically.',
      target: 'chat-section',
      position: 'left',
      highlight: true
    },
    {
      title: 'Report Generation',
      description: 'Switch to Report tab to view AI-generated medical reports. Edit and export as needed.',
      target: 'report-tab',
      position: 'bottom',
      highlight: true
    }
  ];

  const handleNext = () => {
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setCurrentStep(0);
  };

  // Get position style for tooltip based on target element
  const getTooltipPosition = (step) => {
    if (!isOpen) return { display: 'none' };
    
    const targetElement = document.querySelector(`[data-tour="${step.target}"]`);
    if (!targetElement) return { display: 'none' };

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 550; // w-[30rem] = 480px
    const tooltipHeight = 380; // estimated height with padding
    const margin = 20;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16; // padding from viewport edges

    let style = { position: 'fixed' };

    switch (step.position) {
      case 'right':
        // Check if tooltip fits on the right
        if (rect.right + margin + tooltipWidth <= viewportWidth - padding) {
          style.left = `${rect.right + margin}px`;
        } else {
          // Place on left instead
          style.right = `${viewportWidth - rect.left + margin}px`;
        }
        style.top = `${Math.max(padding, Math.min(rect.top + rect.height / 2, viewportHeight - tooltipHeight / 2 - padding))}px`;
        style.transform = 'translateY(-50%)';
        break;
      case 'left':
        // Check if tooltip fits on the left
        if (rect.left - margin - tooltipWidth >= padding) {
          style.right = `${viewportWidth - rect.left + margin}px`;
        } else {
          // Place on right instead
          style.left = `${rect.right + margin}px`;
        }
        style.top = `${Math.max(padding, Math.min(rect.top + rect.height / 2, viewportHeight - tooltipHeight / 2 - padding))}px`;
        style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        style.left = `${Math.max(tooltipWidth / 2 + padding, Math.min(rect.left + rect.width / 2, viewportWidth - tooltipWidth / 2 - padding))}px`;
        // Check if tooltip fits below
        if (rect.bottom + margin + tooltipHeight <= viewportHeight - padding) {
          style.top = `${rect.bottom + margin}px`;
        } else {
          // Place above instead
          style.bottom = `${viewportHeight - rect.top + margin}px`;
        }
        style.transform = 'translateX(-50%)';
        break;
      case 'top':
        style.left = `${Math.max(tooltipWidth / 2 + padding, Math.min(rect.left + rect.width / 2, viewportWidth - tooltipWidth / 2 - padding))}px`;
        // Check if tooltip fits above
        if (rect.top - margin - tooltipHeight >= padding) {
          style.bottom = `${viewportHeight - rect.top + margin}px`;
        } else {
          // Place below instead
          style.top = `${rect.bottom + margin}px`;
        }
        style.transform = 'translateX(-50%)';
        break;
      default:
        break;
    }

    return style;
  };

  // Highlight target element
  useEffect(() => {
    if (!isOpen) return;

    const currentStepData = guideSteps[currentStep];
    const targetElement = document.querySelector(`[data-tour="${currentStepData.target}"]`);
    
    if (targetElement && currentStepData.highlight) {
      targetElement.style.position = 'relative';
      targetElement.style.zIndex = '1001';
      targetElement.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)';
      targetElement.style.borderRadius = '8px';
      targetElement.style.transition = 'all 0.3s ease';

      return () => {
        targetElement.style.position = '';
        targetElement.style.zIndex = '';
        targetElement.style.boxShadow = '';
        targetElement.style.borderRadius = '';
      };
    }
  }, [isOpen, currentStep]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-40 flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 group"
        title="Start Interactive Guide"
        aria-label="Start interactive guide"
      >
        <HelpCircle className="w-7 h-7 transition-transform duration-300 group-hover:rotate-12" />
      </button>
    );
  }

  const currentStepData = guideSteps[currentStep];
  const tooltipStyle = getTooltipPosition(currentStepData);

  return (
    <>
      {/* Dark overlay background */}
      <div 
        className="fixed inset-0 bg-black/40 z-[999] animate-[fadeIn_300ms_ease-out]"
        onClick={handleClose}
      />

      {/* Tooltip */}
      <div
        style={tooltipStyle}
        className="z-[1002] bg-white rounded-lg shadow-2xl p-7 w-[36rem] max-w-[calc(100vw-2rem)] animate-[scaleIn_300ms_ease-out]"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-gray-900 hover:bg-black text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 font-bold text-base leading-none"
          aria-label="Close guide"
        >
          ×
        </button>

        {/* Arrow indicator based on position */}
        {currentStepData.position === 'right' && (
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rotate-45 shadow-lg" />
        )}
        {currentStepData.position === 'left' && (
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rotate-45 shadow-lg" />
        )}
        {currentStepData.position === 'bottom' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 shadow-lg" />
        )}
        {currentStepData.position === 'top' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 shadow-lg" />
        )}

        {/* Step indicator */}
        <div className="text-2xl font-semibold text-blue-600 mb-2">
          STEP {currentStep + 1} OF {guideSteps.length}
        </div>

        {/* Content */}
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {currentStepData.title}
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {currentStepData.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-100 transition-all duration-200 active:scale-95"
          >
            Previous
          </button>

          <div className="flex gap-1.5">
            {guideSteps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  idx === currentStep 
                    ? 'bg-blue-600 w-6' 
                    : idx < currentStep 
                    ? 'bg-blue-300 hover:bg-blue-400' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow hover:shadow-md transition-all duration-200 active:scale-95 flex items-center gap-1"
          >
            {currentStep === guideSteps.length - 1 ? 'Finish' : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};

export default UserGuide;
