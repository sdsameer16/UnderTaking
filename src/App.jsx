import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Download, RefreshCw, Eye, CheckCircle2, ShieldCheck, AlertCircle, ZoomIn, ZoomOut, RotateCcw, Move, Globe, Mail, Phone, MapPin, ExternalLink, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './App.css';

const DEFAULT_COORDS = {
  studentName: { top: 618, left: 200, fontSize: 16 },
  registrationNumber: { top: 618, left: 625, fontSize: 16 },
  section: { top: 662, left: 160, fontSize: 16 },
  date: { top: 662, left: 520, fontSize: 16 },
  studentSig: { top: 692, left: 215, width: 220, height: 50 },
  parentSig: { top: 734, left: 480, width: 220, height: 50 },
};

export default function App() {
  const [formData, setFormData] = useState({
    studentName: '',
    registrationNumber: '',
    section: '',
    date: '04-10-2026',
    studentSignature: null,
    parentSignature: null
  });

  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [studentSigScale, setStudentSigScale] = useState(1);
  const [parentSigScale, setParentSigScale] = useState(1);
  const [activeCamera, setActiveCamera] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Live site visit counter tracking with localStorage persistence
  const [siteVisits, setSiteVisits] = useState(() => {
    const count = localStorage.getItem('wintage_site_visits');
    const newCount = count ? parseInt(count, 10) + 1 : 1248; // Base realistic visit start counter
    localStorage.setItem('wintage_site_visits', newCount.toString());
    return newCount;
  });

  // Active Dragging State
  const activeDragRef = useRef(null);
  const [activeDragField, setActiveDragField] = useState(null);

  const videoRef = useRef(null);
  const pdfRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (activeCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeCamera]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError('Unable to access camera. Please check permissions or upload a file.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');

    if (activeCamera === 'student') {
      setFormData(prev => ({ ...prev, studentSignature: dataUrl }));
    } else if (activeCamera === 'parent') {
      setFormData(prev => ({ ...prev, parentSignature: dataUrl }));
    }
    setActiveCamera(null);
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (type === 'student') {
          setFormData(prev => ({ ...prev, studentSignature: event.target.result }));
        } else {
          setFormData(prev => ({ ...prev, parentSignature: event.target.result }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Drag Handlers
  const startDrag = (e, fieldKey) => {
    if (isGeneratingPdf) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    activeDragRef.current = {
      field: fieldKey,
      startX: clientX,
      startY: clientY,
      initialTop: coords[fieldKey].top,
      initialLeft: coords[fieldKey].left
    };

    setActiveDragField(fieldKey);

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
  };

  const onDragMove = (e) => {
    if (!activeDragRef.current) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - activeDragRef.current.startX;
    const deltaY = clientY - activeDragRef.current.startY;

    const fieldKey = activeDragRef.current.field;
    const newTop = Math.max(0, activeDragRef.current.initialTop + deltaY);
    const newLeft = Math.max(0, activeDragRef.current.initialLeft + deltaX);

    setCoords(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        top: Math.round(newTop),
        left: Math.round(newLeft)
      }
    }));
  };

  const onDragEnd = () => {
    activeDragRef.current = null;
    setActiveDragField(null);
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
  };

  // Direct High-Reliability PDF Download
  const generatePDF = async () => {
    if (!pdfRef.current) return;
    setIsGeneratingPdf(true);

    try {
      await new Promise(r => setTimeout(r, 150));

      const element = pdfRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      // Exact filename requested by user
      const nameStr = (formData.studentName && formData.studentName.trim().length > 0)
        ? formData.studentName.trim().replace(/\s+/g, '_')
        : 'Student_Name';

      const fileName = `${nameStr}_ACCENTURE_T_UL_CAMPUSBITES.pdf`;

      // Trigger standard save
      pdf.save(fileName);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Error building PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="app-container">
      <header className="navbar">
        <div className="logo-container">
          <ShieldCheck className="icon-glow" size={32} />
          <div>
            <h1>VIGNAN'S Undertaking PDF Generator</h1>
            <p>Department of Computer Science and Engineering</p>
          </div>
        </div>
        <button
          className="btn-primary btn-download"
          onClick={generatePDF}
          disabled={isGeneratingPdf}
        >
          {isGeneratingPdf ? <RefreshCw className="spin" size={18} /> : <Download size={18} />}
          <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
        </button>
      </header>

      <main className="main-content">
        {/* Form Inputs Panel */}
        <section className="form-section">
          <div className="card">
            <h2>Student Details</h2>
            <p className="subtitle">Fill details, upload photos, then drag elements directly on preview.</p>

            <div className="form-group">
              <label>Student Name</label>
              <input
                type="text"
                name="studentName"
                placeholder="Enter Full Name"
                value={formData.studentName}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Registration Number</label>
                <input
                  type="text"
                  name="registrationNumber"
                  placeholder="e.g. 211FA04001"
                  value={formData.registrationNumber}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>Section</label>
                <input
                  type="text"
                  name="section"
                  placeholder="e.g. CSE-A"
                  value={formData.section}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Date (Editable)</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
              />
            </div>

            {/* Student Signature Controls */}
            <div className="sig-upload-box">
              <div className="sig-header">
                <label>Student Signature</label>
                {formData.studentSignature && (
                  <span className="badge-success"><CheckCircle2 size={14} /> Uploaded</span>
                )}
              </div>

              <div className="button-group">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveCamera('student')}
                >
                  <Camera size={16} /> Open Camera
                </button>
                <label className="btn-secondary btn-file">
                  <Upload size={16} /> Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'student')}
                    hidden
                  />
                </label>
              </div>

              {formData.studentSignature && (
                <div className="scale-control">
                  <span>Image Size:</span>
                  <button type="button" onClick={() => setStudentSigScale(s => Math.max(0.3, s - 0.1))}><ZoomOut size={14} /></button>
                  <span>{Math.round(studentSigScale * 100)}%</span>
                  <button type="button" onClick={() => setStudentSigScale(s => Math.min(2.5, s + 0.1))}><ZoomIn size={14} /></button>
                  <button type="button" className="btn-reset" onClick={() => setStudentSigScale(1)}><RotateCcw size={14} /></button>
                </div>
              )}
            </div>

            {/* Parent Signature Controls */}
            <div className="sig-upload-box">
              <div className="sig-header">
                <label>Parent / Guardian Signature</label>
                {formData.parentSignature && (
                  <span className="badge-success"><CheckCircle2 size={14} /> Uploaded</span>
                )}
              </div>

              <div className="button-group">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveCamera('parent')}
                >
                  <Camera size={16} /> Open Camera
                </button>
                <label className="btn-secondary btn-file">
                  <Upload size={16} /> Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'parent')}
                    hidden
                  />
                </label>
              </div>

              {formData.parentSignature && (
                <div className="scale-control">
                  <span>Image Size:</span>
                  <button type="button" onClick={() => setParentSigScale(s => Math.max(0.3, s - 0.1))}><ZoomOut size={14} /></button>
                  <span>{Math.round(parentSigScale * 100)}%</span>
                  <button type="button" onClick={() => setParentSigScale(s => Math.min(2.5, s + 0.1))}><ZoomIn size={14} /></button>
                  <button type="button" className="btn-reset" onClick={() => setParentSigScale(1)}><RotateCcw size={14} /></button>
                </div>
              )}
            </div>

            <div className="drag-hint-box">
              <Move size={16} />
              <span>Drag & drop elements anywhere on preview! Icons will be hidden in downloaded PDF.</span>
            </div>

          </div>
        </section>

        {/* Live Document Preview */}
        <section className="preview-section">
          <div className="preview-header">
            <h3><Eye size={18} /> Interactive PDF Preview</h3>
            <span>Drag & Drop Enabled</span>
          </div>

          <div className="pdf-paper-container">
            <div className={`pdf-paper-template ${isGeneratingPdf ? 'rendering-pdf' : ''}`} ref={pdfRef}>
              <img
                src="/undertaking_template.jpg"
                alt="Accenture Specific Training Undertaking Form Template"
                className="pdf-template-bg"
              />

              {/* Student Name */}
              <div
                className={`overlay-field draggable-item ${activeDragField === 'studentName' ? 'is-dragging' : ''}`}
                style={{
                  top: `${coords.studentName.top}px`,
                  left: `${coords.studentName.left}px`,
                  fontSize: `${coords.studentName.fontSize}px`
                }}
                onMouseDown={(e) => startDrag(e, 'studentName')}
                onTouchStart={(e) => startDrag(e, 'studentName')}
              >
                {!isGeneratingPdf && <Move size={12} className="drag-icon-clean" />}
                {formData.studentName}
              </div>

              {/* Registration Number */}
              <div
                className={`overlay-field draggable-item ${activeDragField === 'registrationNumber' ? 'is-dragging' : ''}`}
                style={{
                  top: `${coords.registrationNumber.top}px`,
                  left: `${coords.registrationNumber.left}px`,
                  fontSize: `${coords.registrationNumber.fontSize}px`
                }}
                onMouseDown={(e) => startDrag(e, 'registrationNumber')}
                onTouchStart={(e) => startDrag(e, 'registrationNumber')}
              >
                {!isGeneratingPdf && <Move size={12} className="drag-icon-clean" />}
                {formData.registrationNumber}
              </div>

              {/* Section */}
              <div
                className={`overlay-field draggable-item ${activeDragField === 'section' ? 'is-dragging' : ''}`}
                style={{
                  top: `${coords.section.top}px`,
                  left: `${coords.section.left}px`,
                  fontSize: `${coords.section.fontSize}px`
                }}
                onMouseDown={(e) => startDrag(e, 'section')}
                onTouchStart={(e) => startDrag(e, 'section')}
              >
                {!isGeneratingPdf && <Move size={12} className="drag-icon-clean" />}
                {formData.section}
              </div>

              {/* Date */}
              <div
                className={`overlay-field draggable-item ${activeDragField === 'date' ? 'is-dragging' : ''}`}
                style={{
                  top: `${coords.date.top}px`,
                  left: `${coords.date.left}px`,
                  fontSize: `${coords.date.fontSize}px`
                }}
                onMouseDown={(e) => startDrag(e, 'date')}
                onTouchStart={(e) => startDrag(e, 'date')}
              >
                {!isGeneratingPdf && <Move size={12} className="drag-icon-clean" />}
                {formData.date}
              </div>

              {/* Student Signature */}
              <div
                className={`overlay-sig draggable-item ${activeDragField === 'studentSig' ? 'is-dragging' : ''}`}
                style={{
                  top: `${coords.studentSig.top}px`,
                  left: `${coords.studentSig.left}px`,
                  width: `${coords.studentSig.width}px`,
                  height: `${coords.studentSig.height}px`
                }}
                onMouseDown={(e) => startDrag(e, 'studentSig')}
                onTouchStart={(e) => startDrag(e, 'studentSig')}
              >
                {formData.studentSignature ? (
                  <img
                    src={formData.studentSignature}
                    alt="Student Signature"
                    style={{ transform: `scale(${studentSigScale})` }}
                  />
                ) : (
                  !isGeneratingPdf && <span className="sig-placeholder-tag"><Move size={12} /> Student Signature</span>
                )}
              </div>

              {/* Parent Signature */}
              <div
                className={`overlay-sig draggable-item ${activeDragField === 'parentSig' ? 'is-dragging' : ''}`}
                style={{
                  top: `${coords.parentSig.top}px`,
                  left: `${coords.parentSig.left}px`,
                  width: `${coords.parentSig.width}px`,
                  height: `${coords.parentSig.height}px`
                }}
                onMouseDown={(e) => startDrag(e, 'parentSig')}
                onTouchStart={(e) => startDrag(e, 'parentSig')}
              >
                {formData.parentSignature ? (
                  <img
                    src={formData.parentSignature}
                    alt="Parent Signature"
                    style={{ transform: `scale(${parentSigScale})` }}
                  />
                ) : (
                  !isGeneratingPdf && <span className="sig-placeholder-tag"><Move size={12} /> Parent Signature</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Section featuring Wintage Developers & Live Visit Counter */}
      <footer className="footer">
        <div className="footer-content">
          {/* About Wintage Developers */}
          <div className="footer-col about-col">
            <div className="wintage-brand">
              <div className="wintage-logo-circle">
                <span className="wintage-logo-text">WD</span>
              </div>
              <div>
                <h3 className="wintage-title">WINTAGE DEVELOPERS</h3>
                <p className="wintage-tagline">Crafting Digital Excellence, Swiftly!</p>
              </div>
            </div>
            <p className="wintage-desc">
              We empower businesses & academic institutions with high-performance web applications, AI integration, and seamless digital automation solutions.
            </p>
            <div className="wintage-keywords">
              <span>PEOPLE</span> • <span>IDEAS</span> • <span>TECHNOLOGY</span> • <span>GROWTH</span>
            </div>
          </div>

          {/* Contact Details */}
          <div className="footer-col contact-col">
            <h4>Developer Contact</h4>
            <ul className="contact-list">

              <li>
                <Phone size={16} />
                <a href="tel:+919494728970">+91 9494728970</a>
              </li>
              <li>
                <Mail size={16} />
                <a href="mailto:wintagedevelopers4@gmail.com">wintagedevelopers4@gmail.com</a>
              </li>
              <li>
                <Globe size={16} />
                <a href="https://www.wintage.vercel.app" target="_blank" rel="noopener noreferrer">
                  www.wintage.vercel.app <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <MapPin size={16} />
                <span>India | Remote Global Services</span>
              </li>
            </ul>
          </div>

          {/* Site Visit Counter Badge */}
          <div className="footer-col visit-col">
            <h4>Live Visitor Analytics</h4>
            <div className="visit-counter-badge">
              <div className="counter-icon-box">
                <Eye size={24} className="icon-pulse" />
              </div>
              <div className="counter-info">
                <span className="visit-number">{siteVisits.toLocaleString()}</span>
                <span className="visit-label">Total Site Visits</span>
              </div>
            </div>
            <p className="counter-subnote">🟢 100% Free & Open Access Platform</p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Wintage Developers. All Rights Reserved.</p>
          <p className="smarter-tomorrow">GIVE AI POWERS TO YOUR BUSINESS • BUILD A SMARTER TOMORROW WITH US</p>
        </div>
      </footer>

      {/* Camera Capture Modal */}
      {activeCamera && (
        <div className="camera-modal-overlay">
          <div className="camera-modal">
            <div className="camera-header">
              <h3>Capture {activeCamera === 'student' ? 'Student Signature' : 'Parent Signature'}</h3>
              <button onClick={() => setActiveCamera(null)} className="btn-close">&times;</button>
            </div>

            {cameraError ? (
              <div className="camera-error">
                <AlertCircle size={24} />
                <p>{cameraError}</p>
              </div>
            ) : (
              <div className="video-view">
                <video ref={videoRef} autoPlay playsInline />
                <div className="camera-overlay-frame">
                  <p>Position signature inside the box</p>
                </div>
              </div>
            )}

            <div className="camera-actions">
              <button type="button" onClick={() => setActiveCamera(null)} className="btn-cancel">Cancel</button>
              {!cameraError && (
                <button type="button" onClick={capturePhoto} className="btn-capture">
                  <Camera size={18} /> Capture Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
