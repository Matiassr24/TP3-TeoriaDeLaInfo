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
  const [huffmanStats, setHuffmanStats] = useState(null);
  const [hammingStats, setHammingStats] = useState(null);
  const [flippedBits, setFlippedBits] = useState({});
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
    setFlippedBits({});
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

    // Toggle in flippedBits map
    setFlippedBits(prev => ({
      ...prev,
      [`${blockIdx}-${bitPos}`]: !prev[`${blockIdx}-${bitPos}`]
    }));

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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
        setHuffmanStats(data);
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
        setHuffmanStats(data);
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

  // API Call: Hamming Protect for Work File (e.g. .huf compressed or .txt)
  const handleProtectWorkFile = async () => {
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
        setHammingStats(data);
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
          setHammingStats(data);
          triggerDownload(data.datosBinariosBase64, data.nombreArchivoSugerido);

          // Auto-load desprotegido file as work file so user can immediately decompress it
          const blob = base64ToBlob(data.datosBinariosBase64);
          const autoFile = new File([blob], data.nombreArchivoSugerido, { type: 'application/octet-stream' });
          loadWorkFile(autoFile);
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

  // Helper to convert Uint8Array to base64, trigger download, and auto-load as work file
  const triggerLocalCorruptedFileDownloadAndLoad = (rawBytes) => {
    let ext = '.HE1';
    if (mPower === 10) ext = '.HE2';
    if (mPower === 14) ext = '.HE3';

    let base = workFile ? workFile.name : 'corrupted';
    if (base.includes(".")) {
      base = base.substring(0, base.lastIndexOf("."));
    }
    // Replace .HA to .HE just in case
    base = base.replace('.HA', '.HE');
    const suggestedName = base + ext;

    // Convert rawBytes (Uint8Array) to base64
    let binary = '';
    const len = rawBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(rawBytes[i]);
    }
    const base64Data = btoa(binary);

    // Trigger download
    triggerDownload(base64Data, suggestedName);

    // Auto load as work file
    const blob = base64ToBlob(base64Data);
    const autoFile = new File([blob], suggestedName, { type: 'application/octet-stream' });
    loadWorkFile(autoFile);
  };

  // Local trigger to inject 1 error per block randomly (1% rate, min 1)
  const injectOneErrorLocal = () => {
    if (!workFileParsed) return;
    const { n, blocks, rawBytes } = workFileParsed;
    
    let injected = 0;
    const newFlipped = {};
    const updatedBlocks = blocks.map(b => {
      // 1% probability of error per block
      if (Math.random() < 0.01) {
        const bitIdx = Math.floor(Math.random() * n); // 0 to n-1
        const bitIndex = b.index * n + bitIdx;
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = 7 - (bitIndex % 8);
        
        rawBytes[16 + byteIndex] ^= (1 << bitOffset);
        injected++;
        newFlipped[`${b.index}-${bitIdx + 1}`] = true;
        
        const nextBits = [...b.bits];
        nextBits[bitIdx] ^= 1;
        return { ...b, bits: nextBits };
      }
      return b;
    });

    // If no errors were injected, force exactly 1 error in a random block
    if (injected === 0 && blocks.length > 0) {
      const randomBlockIdx = Math.floor(Math.random() * blocks.length);
      const bitIdx = Math.floor(Math.random() * n);
      
      const b = blocks[randomBlockIdx];
      const bitIndex = b.index * n + bitIdx;
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = 7 - (bitIndex % 8);
      
      rawBytes[16 + byteIndex] ^= (1 << bitOffset);
      injected++;
      newFlipped[`${b.index}-${bitIdx + 1}`] = true;
      
      updatedBlocks[randomBlockIdx] = {
        ...b,
        bits: b.bits.map((bitVal, idx) => idx === bitIdx ? bitVal ^ 1 : bitVal)
      };
    }

    setFlippedBits(newFlipped);
    setWorkFileParsed({
      ...workFileParsed,
      blocks: updatedBlocks,
      rawBytes: rawBytes
    });
    setWorkFileType('corrupted');
    alert(`Inyectado(s) ${injected} error(es) aleatorio(s) (tasa 1% de bloques, min 1). Descargando archivo .HE...`);
    triggerLocalCorruptedFileDownloadAndLoad(rawBytes);
  };

  // Local trigger to inject 2 errors in a random block
  const injectTwoErrorsLocal = () => {
    if (!workFileParsed || workFileParsed.blocks.length === 0) return;
    const { n, blocks, rawBytes } = workFileParsed;
    
    // Select a random block index
    const randomBlockIdx = Math.floor(Math.random() * blocks.length);
    
    // Choose two distinct random bit positions in that block
    let p1 = Math.floor(Math.random() * n);
    let p2 = Math.floor(Math.random() * n);
    while (p1 === p2 && n > 1) {
      p2 = Math.floor(Math.random() * n);
    }
    
    // Flip bit 1
    const bitIndex1 = randomBlockIdx * n + p1;
    const byteIdx1 = Math.floor(bitIndex1 / 8);
    const offset1 = 7 - (bitIndex1 % 8);
    rawBytes[16 + byteIdx1] ^= (1 << offset1);

    // Flip bit 2
    const bitIndex2 = randomBlockIdx * n + p2;
    const byteIdx2 = Math.floor(bitIndex2 / 8);
    const offset2 = 7 - (bitIndex2 % 8);
    rawBytes[16 + byteIdx2] ^= (1 << offset2);

    // Update block bits in visual grid
    const updatedBlocks = blocks.map(b => {
      if (b.index === randomBlockIdx) {
        const nextBits = [...b.bits];
        nextBits[p1] ^= 1;
        nextBits[p2] ^= 1;
        return { ...b, bits: nextBits };
      }
      return b;
    });

    setFlippedBits({
      [`${randomBlockIdx}-${p1 + 1}`]: true,
      [`${randomBlockIdx}-${p2 + 1}`]: true
    });
    setWorkFileParsed({
      ...workFileParsed,
      blocks: updatedBlocks,
      rawBytes: rawBytes
    });
    setWorkFileType('corrupted');
    alert(`Inyectados exactamente 2 errores aleatorios en el módulo ${randomBlockIdx} (posiciones ${p1 + 1} y ${p2 + 1}). Descargando archivo .HE...`);
    triggerLocalCorruptedFileDownloadAndLoad(rawBytes);
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
    setHuffmanStats(null);
    setHammingStats(null);
    setFlippedBits({});
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
      <header className="header-glass" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1.25rem', gap: '0.75rem' }}>
        {/* Brand logo (extremely compact) */}
        <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 'fit-content' }}>
          <Shield className="brand-icon" size={22} color="#3b82f6" />
          <h1 className="brand-title" style={{ fontSize: '1.15rem', margin: 0 }}>PM3 Lab</h1>
        </div>

        {/* Unified Operations Bar */}
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', background: 'rgba(0, 0, 0, 0.25)', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
          {/* Huffman Group */}
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '0 0.15rem' }}>Huf:</span>
          <button 
            className={`btn-primary ${!originalFile || processing ? 'btn-disabled' : ''}`}
            disabled={!originalFile || processing}
            onClick={handleCompress}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', width: 'auto' }}
          >
            <Sparkles size={12} /> Compactar
          </button>
          <button 
            className={`btn-secondary ${!workFile || workFileType !== 'huf' || processing ? 'btn-disabled' : ''}`}
            disabled={!workFile || workFileType !== 'huf' || processing}
            onClick={handleDecompress}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', width: 'auto' }}
          >
            <Download size={12} /> Descompactar
          </button>

          {/* Divider */}
          <div style={{ width: '1px', height: '16px', background: 'var(--surface-border)', margin: '0 0.25rem' }}></div>

          {/* Hamming Group */}
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '0 0.15rem' }}>Ham:</span>
          <button 
            className={`btn-primary ${!workFile || processing || workFileType === 'protected' || workFileType === 'corrupted' ? 'btn-disabled' : ''}`}
            disabled={!workFile || processing || workFileType === 'protected' || workFileType === 'corrupted'}
            onClick={handleProtectWorkFile}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', width: 'auto' }}
          >
            <Shield size={12} /> Proteger
          </button>
          <button 
            className={`btn-success ${!workFile || (workFileType !== 'protected' && workFileType !== 'corrupted') || processing ? 'btn-disabled' : ''}`}
            disabled={!workFile || (workFileType !== 'protected' && workFileType !== 'corrupted') || processing}
            onClick={handleUnprotect}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', width: 'auto' }}
          >
            {corregir ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
            Desproteger
          </button>

          {/* Divider */}
          <div style={{ width: '1px', height: '16px', background: 'var(--surface-border)', margin: '0 0.25rem' }}></div>

          {/* Errores Group */}
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '0 0.15rem' }}>Err:</span>
          <button 
            className={`btn-primary ${!workFileParsed || processing ? 'btn-disabled' : ''}`}
            disabled={!workFileParsed || processing}
            onClick={injectOneErrorLocal}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', width: 'auto' }}
            title={!workFileParsed ? "Carga un archivo Hamming primero" : "Inyectar 1 error aleatorio"}
          >
            <ShieldAlert size={12} /> 1 Error
          </button>
          <button 
            className={`btn-danger ${!workFileParsed || processing ? 'btn-disabled' : ''}`}
            disabled={!workFileParsed || processing}
            onClick={injectTwoErrorsLocal}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', width: 'auto' }}
            title={!workFileParsed ? "Carga un archivo Hamming primero" : "Inyectar 2 errores aleatorios"}
          >
            <AlertTriangle size={12} /> 2 Errores
          </button>

          {/* Processing Indicator */}
          {processing && (
            <>
              <div style={{ width: '1px', height: '16px', background: 'var(--surface-border)', margin: '0 0.25rem' }}></div>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', animation: 'pulse 1.5s infinite', paddingRight: '0.15rem' }}>
                ⌛ ...
              </span>
            </>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs" style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem', borderRadius: '30px', minWidth: 'fit-content' }}>
          <button 
            className={`tab-btn ${activeTab === 'workflow' ? 'active' : ''}`}
            onClick={() => setActiveTab('workflow')}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '20px' }}
          >
            <Activity size={14} />
            Visores
          </button>
          <button 
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '20px' }}
          >
            <Sparkles size={14} />
            Estadísticas
          </button>
        </nav>
      </header>

      {/* Main Grid Layout */}
      <div className="dashboard-grid">
        
        {/* LEFT COLUMN: Controls, File uploading & Operations */}
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
                  accept=".txt,.dhu,.DC1,.DC2,.DC3,.DE1,.DE2,.DE3"
                />
                <div className="dropzone-icon">
                  <FileText size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {originalFile ? `Cargado: ${originalFile.name}` : 'Subí el original (.txt, .dhu, .DC1, etc.)'}
                  </p>
                  <p className="dropzone-sub" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Como referencia o para iniciar compactación
                  </p>
                </div>
              </div>
            </div>

            {/* Work File Zone */}
            <div className="form-group">
              <label className="form-label">Archivo de Trabajo (.txt, .huf, .HA1, .HE1, etc.)</label>
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
                    Permite proteger, descompactar, desproteger o inyectar errores
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          
          {/* TAB 1: VISORES DE DATOS VIEW */}
          {activeTab === 'workflow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                      {/* Left: Original reference file text */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span className="form-label">Texto de Entrada / Referencia (Izquierda):</span>
                        <div className="preview-container">
                          {originalText || (workFileType === 'text' ? workFileText : '') || 'Subí un archivo a la izquierda (.txt o .DCx) para ver su contenido aquí.'}
                        </div>
                      </div>
                      
                      {/* Right: Output/recovered text */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span className="form-label">Resultado del Procesamiento (Derecha):</span>
                        <div className="preview-container" style={{ color: apiResponse?.textoOriginal && apiResponse.textoOriginal.includes("Error") ? 'var(--danger)' : 'hsl(120, 100%, 80%)' }}>
                          {apiResponse?.textoOriginal || (apiResponse?.cadenaBits ? `Cadena de Bits Comprimidos:\n${apiResponse.cadenaBits}` : '') || 'Esperando acción (Compactar / Desproteger / Descompactar)...'}
                        </div>
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



          {/* TAB 3: STATISTICS VIEW */}
          {activeTab === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Huffman stats */}
              <div className="panel">
                <h2 className="panel-title">
                  <Activity size={22} color="#3b82f6" />
                  Estadísticas de Compactación (Huffman)
                </h2>

                {huffmanStats && huffmanStats.frecuencias ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-val">{huffmanStats.tamanoOriginalBytes} B</span>
                        <span className="stat-label">Tamaño Original</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">{huffmanStats.tamanoComprimidoBytes} B</span>
                        <span className="stat-label">Tamaño Comprimido</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">{huffmanStats.ratioCompresion.toFixed(2)}x</span>
                        <span className="stat-label">Ratio de Compresión</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">
                          {huffmanStats.tamanoOriginalBytes > 0 
                            ? ((1 - (huffmanStats.tamanoComprimidoBytes / huffmanStats.tamanoOriginalBytes)) * 100).toFixed(1) 
                            : '0.0'}%
                        </span>
                        <span className="stat-label">Ahorro de Espacio</span>
                      </div>
                    </div>

                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-val">{huffmanStats.entropia.toFixed(3)} bits</span>
                        <span className="stat-label">Entropía H(X)</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">{huffmanStats.longitudMedia.toFixed(3)} bits</span>
                        <span className="stat-label">Longitud Media L</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-val">{(huffmanStats.eficiencia * 100).toFixed(1)}%</span>
                        <span className="stat-label">Eficiencia &eta;</span>
                      </div>
                    </div>

                    {/* Progress visualizer for efficiency */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Eficiencia del Código Huffman</span>
                        <span style={{ fontWeight: 600 }}>{(huffmanStats.eficiencia * 100).toFixed(1)}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${huffmanStats.eficiencia * 100}%` }}></div>
                      </div>
                    </div>

                    {/* Frequencies table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span className="form-label">Tabla de Códigos y Frecuencias</span>
                      <div className="freq-list">
                        {Object.entries(huffmanStats.frecuencias).map(([char, freq]) => {
                          const charDisplay = char === ' ' ? '[Espacio]' : char === '\n' ? '[Salto de Línea]' : char;
                          const code = huffmanStats.codigos[char] || '';
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
                    <p>Subí un archivo y realizá la acción "Compactar Original" o "Descompactar" para visualizar las estadísticas de Huffman.</p>
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
                  
                  {hammingStats && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Estadísticas de la ejecución actual:</h4>
                      
                      {hammingStats.redundancyPercentage !== undefined && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sobrecarga / Redundancia añadida:</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--secondary)' }}>{hammingStats.redundancyPercentage.toFixed(2)}%</p>
                          </div>
                          <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tamaño protegido:</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{hammingStats.tamanoComprimidoBytes} Bytes</p>
                          </div>
                        </div>
                      )}

                      {hammingStats.totalBlocks !== undefined && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
                          <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bloques procesados:</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{hammingStats.totalBlocks}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Errores corregidos (SEC):</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{hammingStats.singleErrorsCorrected}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Errores dobles det. (DED):</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: hammingStats.doubleErrorsDetected > 0 ? 'var(--danger)' : 'var(--text-main)' }}>{hammingStats.doubleErrorsDetected}</p>
                          </div>
                        </div>
                      )}
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
