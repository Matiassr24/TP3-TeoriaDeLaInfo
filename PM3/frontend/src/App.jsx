import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Download, Upload, Shield, ShieldAlert, ShieldCheck, 
  Lock, Unlock, Settings, Activity, RotateCcw, Info, Clock, 
  Sparkles, Binary, CheckCircle, AlertTriangle 
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('workflow'); // workflow, interactive, stats
  
  // State for files
  const [originalFile, setOriginalFile] = useState(null);
  const [originalText, setOriginalText] = useState('');
  
  // Work file (could be .txt, .huf, .HA1, .HA2, .HA3, .HE1, etc.)
  const [workFile, setWorkFile] = useState(null);
  const [workFileText, setWorkFileText] = useState('');
  const [workFileType, setWorkFileType] = useState(''); // text, huf, protected, corrupted
  const [workFileParsed, setWorkFileParsed] = useState(null); // parsed local Hamming data

  // Settings
  const [mPower, setMPower] = useState(3); // default HA1 (8 bits)
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockDate, setLockDate] = useState('');
  const [corregir, setCorregir] = useState(true);

  // Results & stats
  const [processing, setProcessing] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [lockTimerId, setLockTimerId] = useState(null);

  // Drag and drop states
  const [dragOverOrig, setDragOverOrig] = useState(false);
  const [dragOverWork, setDragOverWork] = useState(false);

  // File Inputs
  const origInputRef = useRef(null);
  const workInputRef = useRef(null);

  // Reset Lock Countdown when needed
  useEffect(() => {
    if (lockTimerId) clearInterval(lockTimerId);
    setCountdown('');
    
    if (apiResponse && apiResponse.locked) {
      const interval = setInterval(() => {
        const remaining = apiResponse.lockTimestamp - Date.now();
        if (remaining <= 0) {
          setCountdown('Desbloqueado');
          setApiResponse(prev => ({ ...prev, locked: false }));
          clearInterval(interval);
        } else {
          const secs = Math.ceil(remaining / 1000);
          const m = Math.floor(secs / 60);
          const s = secs % 60;
          setCountdown(`${m}:${s < 10 ? '0' : ''}${s}`);
        }
      }, 1000);
      setLockTimerId(interval);
      return () => clearInterval(interval);
    }
  }, [apiResponse]);

  const handleOrigFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) loadOriginalFile(file);
  };

  const handleWorkFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) loadWorkFile(file);
  };

  const loadOriginalFile = async (file) => {
    setOriginalFile(file);
    try {
      const text = await file.text();
      setOriginalText(text.substring(0, 50000)); // preview limit
    } catch (e) {
      setOriginalText('Archivo binario cargado (vista previa no disponible).');
    }
  };

  const loadWorkFile = async (file) => {
    setWorkFile(file);
    setApiResponse(null);
    const name = file.name.toUpperCase();
    
    let type = 'text';
    if (name.endsWith('.HUF')) {
      type = 'huf';
    } else if (name.match(/\.(HA|HE|DE|DC)\d$/)) {
      type = 'protected';
      if (name.includes('.HE')) type = 'corrupted';
    }
    setWorkFileType(type);

    // Read preview text if possible
    if (type === 'text') {
      try {
        const text = await file.text();
        setWorkFileText(text.substring(0, 10000));
      } catch (e) {
        setWorkFileText('Archivo binario o ilegible.');
      }
      setWorkFileParsed(null);
    } else {
      setWorkFileText('Archivo codificado binario. Cargado en memoria.');
      
      // Parse Hamming locally if it's protected
      if (type === 'protected' || type === 'corrupted') {
        const parsed = await parseHammingFileLocal(file);
        setWorkFileParsed(parsed);
        if (parsed) {
          setMPower(parsed.mPower);
        }
      } else {
        setWorkFileParsed(null);
      }
    }
  };

  // Local parser for Hamming protected files
  const parseHammingFileLocal = async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      if (buffer.byteLength < 16) return null;
      const view = new DataView(buffer);
      
      // Verify magic 'PM'
      const m1 = view.getUint8(0);
      const m2 = view.getUint8(1);
      if (m1 !== 0x50 || m2 !== 0x4D) return null;

      const mPower = view.getUint8(2);
      const isHuffman = view.getUint8(3) === 1;
      const originalSize = view.getInt32(4);
      const lockTimestamp = Number(view.getBigInt64(8));
      
      const n = 1 << mPower;
      const payloadBytes = new Uint8Array(buffer, 16);
      
      // Convert payload bytes to bits
      const bits = [];
      for (let i = 0; i < payloadBytes.length; i++) {
        const b = payloadBytes[i];
        for (let bit = 7; bit >= 0; bit--) {
          bits.push((b >> bit) & 1);
        }
      }
      
      const totalBlocks = Math.floor(bits.length / n);
      const blocksToDisplay = Math.min(totalBlocks, 50); // limit DOM impact
      
      const blocks = [];
      for (let b = 0; b < blocksToDisplay; b++) {
        const blockBits = [];
        for (let j = 1; j <= n; j++) {
          blockBits.push(bits[b * n + j - 1]);
        }
        blocks.push({
          index: b,
          bits: blockBits
        });
      }

      return {
        mPower,
        n,
        isHuffman,
        originalSize,
        lockTimestamp,
        blocks,
        totalBlocks,
        rawBytes: new Uint8Array(buffer)
      };
    } catch (e) {
      console.error('Error parsing Hamming file locally', e);
      return null;
    }
  };

  // Flip bit locally
  const handleBitClick = (blockIdx, bitPos) => {
    if (!workFileParsed) return;
    
    const { n, rawBytes, blocks } = workFileParsed;
    const bitIndex = blockIdx * n + (bitPos - 1);
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = 7 - (bitIndex % 8);
    
    // Flip bit in raw bytes buffer (offset 16 for header)
    rawBytes[16 + byteIndex] ^= (1 << bitOffset);
    
    // Toggle in local react state for visual rendering
    const updatedBlocks = blocks.map(b => {
      if (b.index === blockIdx) {
        const nextBits = [...b.bits];
        nextBits[bitPos - 1] ^= 1;
        return { ...b, bits: nextBits };
      }
      return b;
    });

    // Determine if corrupted
    setWorkFileParsed({
      ...workFileParsed,
      blocks: updatedBlocks,
      rawBytes: rawBytes
    });
    setWorkFileType('corrupted');
  };

  // Helper: check if index is power of 2
  const isPowerOfTwo = (x) => {
    return (x > 0) && ((x & (x - 1)) === 0);
  };

  // Helper: convert base64 to blob
  const base64ToBlob = (base64Data) => {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'application/octet-stream' });
  };

  // Helper: download blob
  const triggerDownload = (base64Data, filename) => {
    const blob = base64ToBlob(base64Data);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  // API Call: Huffman Compress
  const handleCompress = async () => {
    if (!originalFile) return;
    setProcessing(true);
    setApiResponse(null);

    const formData = new FormData();
    formData.append('file', originalFile);

    try {
      const response = await fetch('/api/pm3/huffman/compress', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        setApiResponse(data);
        triggerDownload(data.datosBinariosBase64, data.nombreArchivoSugerido);
        // Load the compressed file automatically as the work file
        const blob = base64ToBlob(data.datosBinariosBase64);
        const autoFile = new File([blob], data.nombreArchivoSugerido, { type: 'application/octet-stream' });
        loadWorkFile(autoFile);
      } else {
        alert('Error al comprimir con Huffman.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión (' + e.message + ')');
    } finally {
      setProcessing(false);
    }
  };

  // API Call: Huffman Decompress
  const handleDecompress = async () => {
    if (!workFile) return;
    setProcessing(true);
    setApiResponse(null);

    const formData = new FormData();
    formData.append('file', workFile);

    try {
      const response = await fetch('/api/pm3/huffman/decompress', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        setApiResponse(data);
        triggerDownload(data.datosBinariosBase64, data.nombreArchivoSugerido);
      } else {
        alert('Error al descomprimir. ¿El archivo es un .huf válido?');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión (' + e.message + ')');
    } finally {
      setProcessing(false);
    }
  };

  // API Call: Hamming Protect
  const handleProtect = async () => {
    if (!workFile) return;
    setProcessing(true);
    setApiResponse(null);

    const formData = new FormData();
    formData.append('file', workFile);
    formData.append('mPower', mPower);
    
    let timestamp = 0;
    if (lockEnabled && lockDate) {
      timestamp = new Date(lockDate).getTime();
    }
    formData.append('lockTimestamp', timestamp);

    try {
      const response = await fetch('/api/pm3/hamming/protect', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        setApiResponse(data);
        triggerDownload(data.datosBinariosBase64, data.nombreArchivoSugerido);
        
        // Auto-load protected file as work file
        const blob = base64ToBlob(data.datosBinariosBase64);
        const autoFile = new File([blob], data.nombreArchivoSugerido, { type: 'application/octet-stream' });
        loadWorkFile(autoFile);
      } else {
        alert('Error al aplicar protección Hamming.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión (' + e.message + ')');
    } finally {
      setProcessing(false);
    }
  };

  // API Call: Hamming Unprotect
  const handleUnprotect = async () => {
    if (!workFile) return;
    setProcessing(true);
    setApiResponse(null);

    const formData = new FormData();
    // If local edits were made, we send the edited bytes!
    if (workFileParsed && workFileParsed.rawBytes) {
      const blob = new Blob([workFileParsed.rawBytes], { type: 'application/octet-stream' });
      const editedFile = new File([blob], workFile.name, { type: 'application/octet-stream' });
      formData.append('file', editedFile);
    } else {
      formData.append('file', workFile);
    }
    formData.append('corregir', corregir);

    try {
      const response = await fetch('/api/pm3/hamming/unprotect', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        if (data.locked) {
          setApiResponse({ ...data, locked: true });
        } else {
          setApiResponse(data);
          triggerDownload(data.datosBinariosBase64, data.nombreArchivoSugerido);
        }
      } else {
        alert('Error al desproteger. Asegurate de que el archivo tenga una cabecera Hamming válida.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión (' + e.message + ')');
    } finally {
      setProcessing(false);
    }
  };

  // Local trigger to inject 1 error per block randomly
  const injectOneErrorLocal = () => {
    if (!workFileParsed) return;
    const { n, blocks, rawBytes } = workFileParsed;
    
    // For each block, with 50% probability, we toggle a random bit
    let injected = 0;
    const updatedBlocks = blocks.map(b => {
      if (Math.random() < 0.5) {
        const bitIdx = Math.floor(Math.random() * n); // 0 to n-1
        const bitIndex = b.index * n + bitIdx;
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = 7 - (bitIndex % 8);
        
        rawBytes[16 + byteIndex] ^= (1 << bitOffset);
        injected++;
        
        const nextBits = [...b.bits];
        nextBits[bitIdx] ^= 1;
        return { ...b, bits: nextBits };
      }
      return b;
    });

    setWorkFileParsed({
      ...workFileParsed,
      blocks: updatedBlocks,
      rawBytes: rawBytes
    });
    setWorkFileType('corrupted');
    alert(`Inyectado 1 error aleatorio en ${injected} bloques.`);
  };

  // Local trigger to inject 2 errors in the first block
  const injectTwoErrorsLocal = () => {
    if (!workFileParsed || workFileParsed.blocks.length === 0) return;
    const { n, rawBytes } = workFileParsed;
    
    // Choose block 0, flip bits at position 2 and 4 (0-indexed indices)
    const p1 = 2;
    const p2 = 5;
    
    const bitIndex1 = p1;
    const byteIdx1 = Math.floor(bitIndex1 / 8);
    const offset1 = 7 - (bitIndex1 % 8);
    rawBytes[16 + byteIdx1] ^= (1 << offset1);

    const bitIndex2 = p2;
    const byteIdx2 = Math.floor(bitIndex2 / 8);
    const offset2 = 7 - (bitIndex2 % 8);
    rawBytes[16 + byteIdx2] ^= (1 << offset2);

    // Update block bits in visual grid
    const updatedBlocks = workFileParsed.blocks.map(b => {
      if (b.index === 0) {
        const nextBits = [...b.bits];
        nextBits[p1] ^= 1;
        nextBits[p2] ^= 1;
        return { ...b, bits: nextBits };
      }
      return b;
    });

    setWorkFileParsed({
      ...workFileParsed,
      blocks: updatedBlocks,
      rawBytes: rawBytes
    });
    setWorkFileType('corrupted');
    alert('Inyectados exactamente 2 errores programados en el primer bloque (posiciones 3 y 6).');
  };

  // Reset file loaders
  const handleReset = () => {
    setOriginalFile(null);
    setOriginalText('');
    setWorkFile(null);
    setWorkFileText('');
    setWorkFileType('');
    setWorkFileParsed(null);
    setApiResponse(null);
  };

  // Drag and drop event handlers
  const handleDragOverOrig = (e) => {
    e.preventDefault();
    setDragOverOrig(true);
  };
  const handleDragLeaveOrig = () => {
    setDragOverOrig(false);
  };
  const handleDropOrig = (e) => {
    e.preventDefault();
    setDragOverOrig(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadOriginalFile(file);
  };

  const handleDragOverWork = (e) => {
    e.preventDefault();
    setDragOverWork(true);
  };
  const handleDragLeaveWork = () => {
    setDragOverWork(false);
  };
  const handleDropWork = (e) => {
    e.preventDefault();
    setDragOverWork(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadWorkFile(file);
  };

  return (
    <div className="app-container">
      {/* Brand Header */}
      <header className="header-glass">
        <div className="brand-section">
          <Shield className="brand-icon" size={32} color="#3b82f6" />
          <div>
            <h1 className="brand-title">Proyecto Laboratorio Final</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Teoría de la Información &bull; 2026</p>
          </div>
          <span className="brand-badge">PM3: Huffman + Hamming</span>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button 
            className={`tab-btn ${activeTab === 'workflow' ? 'active' : ''}`}
            onClick={() => setActiveTab('workflow')}
          >
            <Activity size={18} />
            Flujo de Trabajo
          </button>
          <button 
            className={`tab-btn ${activeTab === 'interactive' ? 'active' : ''}`}
            onClick={() => setActiveTab('interactive')}
            disabled={!workFileParsed}
            title={!workFileParsed ? "Cargá un archivo Hamming primero" : ""}
          >
            <Binary size={18} />
            Inyector de Errores
          </button>
          <button 
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <Sparkles size={18} />
            Estadísticas
          </button>
        </nav>
      </header>

      {/* Main Grid Layout */}
      <div className="dashboard-grid">
        
        {/* LEFT COLUMN: Controls & File uploading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* File Inputs Card */}
          <div className="panel">
            <h2 className="panel-title">
              <Upload size={22} color="#3b82f6" />
              1. Carga de Archivos
            </h2>
            
            {/* Original File Zone (Optional Ref) */}
            <div className="form-group">
              <label className="form-label">Archivo de Entrada Original (Texto)</label>
              <div 
                className={`dropzone ${dragOverOrig ? 'active' : ''}`}
                onDragOver={handleDragOverOrig}
                onDragLeave={handleDragLeaveOrig}
                onDrop={handleDropOrig}
                onClick={() => origInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={origInputRef} 
                  onChange={handleOrigFileSelect} 
                  style={{ display: 'none' }} 
                  accept=".txt"
                />
                <div className="dropzone-icon">
                  <FileText size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {originalFile ? `Cargado: ${originalFile.name}` : 'Subí el archivo original .txt'}
                  </p>
                  <p className="dropzone-sub" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Para iniciar el proceso de compactación y protección
                  </p>
                </div>
              </div>
            </div>

            {/* Work File Zone */}
            <div className="form-group">
              <label className="form-label">Archivo de Trabajo (.huf, .HA1, .HE1, etc.)</label>
              <div 
                className={`dropzone ${dragOverWork ? 'active' : ''}`}
                onDragOver={handleDragOverWork}
                onDragLeave={handleDragLeaveWork}
                onDrop={handleDropWork}
                onClick={() => workInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={workInputRef} 
                  onChange={handleWorkFileSelect} 
                  style={{ display: 'none' }}
                />
                <div className="dropzone-icon">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {workFile ? `Trabajando: ${workFile.name}` : 'Subí un archivo a procesar o analizar'}
                  </p>
                  <p className="dropzone-sub" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Permite descompactar, desproteger, o inyectar errores
                  </p>
                </div>
              </div>
            </div>

            {/* Reset button */}
            {(originalFile || workFile) && (
              <button className="btn-secondary" onClick={handleReset}>
                <RotateCcw size={16} /> Limpiar Estado
              </button>
            )}
          </div>

          {/* Configuration Parameters Card */}
          <div className="panel">
            <h2 className="panel-title">
              <Settings size={22} color="#8b5cf6" />
              2. Parámetros de Simulación
            </h2>

            {/* Hamming Block Size */}
            <div className="form-group">
              <label className="form-label">Tamaño de Módulo Hamming</label>
              <div className="options-grid">
                <div 
                  className={`option-card ${mPower === 3 ? 'active' : ''}`}
                  onClick={() => setMPower(3)}
                >
                  <span className="option-title">HA1</span>
                  <span className="option-subtitle">Bloque 8 bits</span>
                </div>
                <div 
                  className={`option-card ${mPower === 10 ? 'active' : ''}`}
                  onClick={() => setMPower(10)}
                >
                  <span className="option-title">HA2</span>
                  <span className="option-subtitle">Bloque 1KB</span>
                </div>
                <div 
                  className={`option-card ${mPower === 14 ? 'active' : ''}`}
                  onClick={() => setMPower(14)}
                >
                  <span className="option-title">HA3</span>
                  <span className="option-subtitle">Bloque 16KB</span>
                </div>
              </div>
            </div>

            {/* Lock Date/Time */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={lockEnabled} 
                    onChange={(e) => setLockEnabled(e.target.checked)} 
                  />
                  Habilitar Fecha de Apertura
                </label>
              </div>
              {lockEnabled && (
                <input 
                  type="datetime-local" 
                  className="form-input"
                  value={lockDate}
                  onChange={(e) => setLockDate(e.target.value)}
                />
              )}
            </div>

            {/* Correction mode */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={corregir} 
                  onChange={(e) => setCorregir(e.target.checked)} 
                />
                Aplicar Corrección al Desproteger
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1.25rem' }}>
                Si se desmarca, se desactivará el algoritmo corrector (desproteger sin corregir)
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Action panels & Interactive bit flip */}
        <div>
          
          {/* TAB 1: WORKFLOW VIEW */}
          {activeTab === 'workflow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Operations panel */}
              <div className="panel">
                <h2 className="panel-title">
                  <Activity size={22} color="#10b981" />
                  Operaciones Disponibles
                </h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  
                  {/* Huffman Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid var(--surface-border)', paddingRight: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Compresión (Huffman)</h3>
                    
                    <button 
                      className={`btn-primary ${!originalFile || processing ? 'btn-disabled' : ''}`}
                      disabled={!originalFile || processing}
                      onClick={handleCompress}
                    >
                      <Sparkles size={16} /> Compactar Original
                    </button>
                    
                    <button 
                      className={`btn-secondary ${!workFile || workFileType !== 'huf' || processing ? 'btn-disabled' : ''}`}
                      disabled={!workFile || workFileType !== 'huf' || processing}
                      onClick={handleDecompress}
                    >
                      <Download size={16} /> Descompactar (.huf)
                    </button>
                  </div>
                  
                  {/* Hamming Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Protección (Hamming)</h3>
                    
                    <button 
                      className={`btn-primary ${!workFile || processing || workFileType === 'protected' ? 'btn-disabled' : ''}`}
                      disabled={!workFile || processing || workFileType === 'protected'}
                      onClick={handleProtect}
                    >
                      <Shield size={16} /> Proteger Archivo
                    </button>
                    
                    <button 
                      className={`btn-success ${!workFile || (workFileType !== 'protected' && workFileType !== 'corrupted') || processing ? 'btn-disabled' : ''}`}
                      disabled={!workFile || (workFileType !== 'protected' && workFileType !== 'corrupted') || processing}
                      onClick={handleUnprotect}
                    >
                      {corregir ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                      Desproteger Archivo
                    </button>
                  </div>
                </div>

                {processing && (
                  <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.1)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    ⌛ Procesando en el servidor backend...
                  </div>
                )}
              </div>

              {/* View/Result Panel */}
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">
                    <FileText size={22} color="#3b82f6" />
                    Vista Previa de Datos
                  </h2>
                  {apiResponse && apiResponse.nombreArchivoSugerido && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      Generado: {apiResponse.nombreArchivoSugerido}
                    </span>
                  )}
                </div>

                {/* Lock Screen */}
                {apiResponse && apiResponse.locked ? (
                  <div className="lock-overlay">
                    <Lock size={48} color="var(--danger)" />
                    <div>
                      <h3>Archivo Encriptado / Protegido</h3>
                      <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>El archivo se encuentra bloqueado hasta cumplir con la fecha de apertura.</p>
                    </div>
                    <div className="lock-timer">
                      {countdown || 'Cargando...'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--danger)' }}>
                      <Clock size={14} /> Desproteger inhabilitado temporalmente.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span className="form-label">
                        {apiResponse?.textoOriginal ? 'Texto Recuperado / Resultado:' : 'Texto Original / Vista Previa:'}
                      </span>
                      <div className="preview-container">
                        {apiResponse?.textoOriginal || originalText || workFileText || 'Esperando archivo o acción...'}
                      </div>
                    </div>

                    {/* Hamming unprotect metrics preview */}
                    {apiResponse && apiResponse.totalBlocks > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resultado del decodificador Hamming</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{apiResponse.totalBlocks}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bloques</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{apiResponse.singleErrorsCorrected}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Er. Corregidos</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: apiResponse.doubleErrorsDetected > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                              {apiResponse.doubleErrorsDetected}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Er. Dobles Det.</p>
                          </div>
                        </div>
                        {apiResponse.doubleErrorsDetected > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', background: 'var(--danger-glow)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--danger)' }}>
                            <AlertTriangle size={14} color="var(--danger)" />
                            <p style={{ fontSize: '0.75rem', color: '#fecaca' }}>Se detectaron errores dobles que no pudieron ser corregidos. El texto recuperado podría contener ruido.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE BIT INJECTOR VIEW */}
          {activeTab === 'interactive' && workFileParsed && (
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  <Binary size={22} color="#3b82f6" />
                  Inyector de Errores Interactivo (SEC-DED)
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto' }} onClick={injectOneErrorLocal}>
                    1 Error Aleatorio
                  </button>
                  <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto' }} onClick={injectTwoErrorsLocal}>
                    2 Errores (Blq. 0)
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Visualización de los primeros bloques del archivo protegido. 
                  Hacé clic en cualquier celda de bit para <strong>invertirlo (flip)</strong> e introducir un error de manera programada.
                </p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                    <span className="bit-cell bit-data" style={{ width: 14, height: 14, cursor: 'default' }}></span> Datos
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                    <span className="bit-cell bit-parity" style={{ width: 14, height: 14, cursor: 'default' }}></span> Paridad Hamming
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                    <span className="bit-cell bit-global" style={{ width: 14, height: 14, cursor: 'default' }}></span> Paridad Global (SEC-DED)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                    <span className="bit-cell bit-corrupted" style={{ width: 14, height: 14, cursor: 'default', animation: 'none' }}></span> Bit Invertido (Error)
                  </span>
                </div>
              </div>

              {/* Bit grid visualizer */}
              <div className="bits-grid-container">
                {workFileParsed.blocks.map(block => (
                  <div key={block.index} className="block-row">
                    <div className="block-header">
                      <span>Módulo {block.index}</span>
                      <span>Total bits: {block.bits.length}</span>
                    </div>
                    <div className="block-bits">
                      {block.bits.map((bitVal, bitIdx) => {
                        const bitNum = bitIdx + 1; // 1-indexed position
                        const isGlobal = bitNum === workFileParsed.n;
                        const isParity = isPowerOfTwo(bitNum) && !isGlobal;
                        
                        // Check if this bit was changed (we compare against original bytes if we want, or just render it active)
                        // For styling simplicity, we can let user see 0/1, and if they click they see the color toggle
                        let cellClass = "bit-cell bit-data";
                        if (isGlobal) cellClass = "bit-cell bit-global";
                        else if (isParity) cellClass = "bit-cell bit-parity";

                        // We can mark flipped bits by tracking changes. For simplicity let's compare with the byte from original workFile
                        // But since we write directly into rawBytes, we can just render the cell values!
                        return (
                          <div 
                            key={bitIdx}
                            className={cellClass}
                            onClick={() => handleBitClick(block.index, bitNum)}
                            title={`Pos: ${bitNum} (${isGlobal ? 'Paridad Global' : isParity ? 'Paridad' : 'Datos'}) - Haz clic para voltear`}
                          >
                            {bitVal}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn-primary" 
                  onClick={async () => {
                    const blob = new Blob([workFileParsed.rawBytes], { type: 'application/octet-stream' });
                    const file = new File([blob], workFile.name.replace('.HA', '.HE'), { type: 'application/octet-stream' });
                    setWorkFile(file);
                    setWorkFileType('corrupted');
                    alert("Cambios guardados en memoria del Archivo de Trabajo. Ahora podés presionar 'Desproteger Archivo' en la pestaña Flujo de Trabajo.");
                    setActiveTab('workflow');
                  }}
                >
                  <CheckCircle size={16} /> Aplicar Errores a Archivo de Trabajo
                </button>
                <button 
                  className="btn-secondary"
                  onClick={async () => {
                    // Dowload the corrupted file directly!
                    const blob = new Blob([workFileParsed.rawBytes], { type: 'application/octet-stream' });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    
                    let ext = ".HE1";
                    if (mPower === 10) ext = ".HE2";
                    if (mPower === 14) ext = ".HE3";

                    let base = workFile.name;
                    if (base.contains(".")) base = base.substring(0, base.lastIndexOf("."));
                    
                    link.download = base + ext;
                    link.click();
                  }}
                >
                  <Download size={16} /> Descargar .HE (Con Errores)
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: STATISTICS VIEW */}
          {activeTab === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Huffman stats */}
              <div className="panel">
                <h2 className="panel-title">
                  <Activity size={22} color="#3b82f6" />
                  Estadísticas de Compactación (Huffman)
                </h2>

                {apiResponse && apiResponse.frecuencias ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-val">{apiResponse.tamanoOriginalBytes} B</span>
                        <span className="stat-label">Tamaño Original</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">{apiResponse.tamanoComprimidoBytes} B</span>
                        <span className="stat-label">Tamaño Comprimido</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">{apiResponse.ratioCompresion.toFixed(2)}x</span>
                        <span className="stat-label">Ratio de Compresión</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">{((1 - (apiResponse.tamanoComprimidoBytes / apiResponse.tamanoOriginalBytes)) * 100).toFixed(1)}%</span>
                        <span className="stat-label">Ahorro de Espacio</span>
                      </div>
                    </div>

                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-val">{apiResponse.entropia.toFixed(3)} bits</span>
                        <span className="stat-label">Entropía H(X)</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">{apiResponse.longitudMedia.toFixed(3)} bits</span>
                        <span className="stat-label">Longitud Media L</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">{(apiResponse.eficiencia * 100).toFixed(1)}%</span>
                        <span className="stat-label">Eficiencia &eta;</span>
                      </div>
                    </div>

                    {/* Progress visualizer for efficiency */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Eficiencia del Código Huffman</span>
                        <span style={{ fontWeight: 600 }}>{(apiResponse.eficiencia * 100).toFixed(1)}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${apiResponse.eficiencia * 100}%` }}></div>
                      </div>
                    </div>

                    {/* Frequencies table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span className="form-label">Tabla de Códigos y Frecuencias</span>
                      <div className="freq-list">
                        {Object.entries(apiResponse.frecuencias).map(([char, freq]) => {
                          const charDisplay = char === ' ' ? '[Espacio]' : char === '\n' ? '[Salto de Línea]' : char;
                          const code = apiResponse.codigos[char] || '';
                          return (
                            <div className="freq-row" key={char}>
                              <span>Character: <strong>{charDisplay}</strong></span>
                              <span>Frecuencia: {freq}</span>
                              <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>Código: {code}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    <Info size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                    <p>Subí un archivo y realizá la acción "Compactar Original" para visualizar las estadísticas de Huffman.</p>
                  </div>
                )}
              </div>

              {/* Hamming stats */}
              <div className="panel">
                <h2 className="panel-title">
                  <Shield size={22} color="#8b5cf6" />
                  Estadísticas de Protección (Hamming)
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-val">HA1 (8 bits)</span>
                      <span className="stat-label">Paridad: 4 bits/bloque (50% overhead)</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-val">HA2 (1024 bits)</span>
                      <span className="stat-label">Paridad: 11 bits/bloque (1.1% overhead)</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-val">HA3 (16384)</span>
                      <span className="stat-label">Paridad: 15 bits/bloque (0.09% overhead)</span>
                    </div>
                  </div>
                  
                  {apiResponse && apiResponse.redundancyPercentage !== undefined && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Estadísticas de la ejecución actual:</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sobrecarga / Redundancia añadida:</p>
                          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--secondary)' }}>{apiResponse.redundancyPercentage.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tamaño protegido:</p>
                          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{apiResponse.tamanoComprimidoBytes} Bytes</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

export default App;
