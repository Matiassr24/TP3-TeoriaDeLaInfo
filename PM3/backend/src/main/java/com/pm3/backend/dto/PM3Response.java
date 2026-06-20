package com.pm3.backend.dto;

import java.util.Map;

public class PM3Response {
    private String textoOriginal;
    private String textoComprimido;
    private Map<Character, Integer> frecuencias;
    private Map<Character, String> codigos;
    private double entropia;
    private double longitudMedia;
    private double eficiencia;
    private long tamanoOriginalBytes;
    private long tamanoComprimidoBytes;
    private long tamanoDescomprimidoBytes;
    private double ratioCompresion;
    private String cadenaBits;
    private int mPower;
    private int totalBlocks;
    private int singleErrorsCorrected;
    private int doubleErrorsDetected;
    private double redundancyPercentage;
    private boolean isLocked;
    private long lockTimestamp;
    private String datosBinariosBase64;
    private String nombreArchivoSugerido;

    public PM3Response() {}

    public PM3Response(String textoOriginal, String textoComprimido, Map<Character, Integer> frecuencias, 
                       Map<Character, String> codigos, double entropia, double longitudMedia, double eficiencia, 
                       long tamanoOriginalBytes, long tamanoComprimidoBytes, long tamanoDescomprimidoBytes, 
                       double ratioCompresion, String cadenaBits, int mPower, int totalBlocks, 
                       int singleErrorsCorrected, int doubleErrorsDetected, double redundancyPercentage, 
                       boolean isLocked, long lockTimestamp, String datosBinariosBase64, String nombreArchivoSugerido) {
        this.textoOriginal = textoOriginal;
        this.textoComprimido = textoComprimido;
        this.frecuencias = frecuencias;
        this.codigos = codigos;
        this.entropia = entropia;
        this.longitudMedia = longitudMedia;
        this.eficiencia = eficiencia;
        this.tamanoOriginalBytes = tamanoOriginalBytes;
        this.tamanoComprimidoBytes = tamanoComprimidoBytes;
        this.tamanoDescomprimidoBytes = tamanoDescomprimidoBytes;
        this.ratioCompresion = ratioCompresion;
        this.cadenaBits = cadenaBits;
        this.mPower = mPower;
        this.totalBlocks = totalBlocks;
        this.singleErrorsCorrected = singleErrorsCorrected;
        this.doubleErrorsDetected = doubleErrorsDetected;
        this.redundancyPercentage = redundancyPercentage;
        this.isLocked = isLocked;
        this.lockTimestamp = lockTimestamp;
        this.datosBinariosBase64 = datosBinariosBase64;
        this.nombreArchivoSugerido = nombreArchivoSugerido;
    }

    // Getters and Setters
    public String getTextoOriginal() { return textoOriginal; }
    public void setTextoOriginal(String textoOriginal) { this.textoOriginal = textoOriginal; }
    
    public String getTextoComprimido() { return textoComprimido; }
    public void setTextoComprimido(String textoComprimido) { this.textoComprimido = textoComprimido; }

    public Map<Character, Integer> getFrecuencias() { return frecuencias; }
    public void setFrecuencias(Map<Character, Integer> frecuencias) { this.frecuencias = frecuencias; }

    public Map<Character, String> getCodigos() { return codigos; }
    public void setCodigos(Map<Character, String> codigos) { this.codigos = codigos; }

    public double getEntropia() { return entropia; }
    public void setEntropia(double entropia) { this.entropia = entropia; }

    public double getLongitudMedia() { return longitudMedia; }
    public void setLongitudMedia(double longitudMedia) { this.longitudMedia = longitudMedia; }

    public double getEficiencia() { return eficiencia; }
    public void setEficiencia(double eficiencia) { this.eficiencia = eficiencia; }

    public long getTamanoOriginalBytes() { return tamanoOriginalBytes; }
    public void setTamanoOriginalBytes(long tamanoOriginalBytes) { this.tamanoOriginalBytes = tamanoOriginalBytes; }

    public long getTamanoComprimidoBytes() { return tamanoComprimidoBytes; }
    public void setTamanoComprimidoBytes(long tamanoComprimidoBytes) { this.tamanoComprimidoBytes = tamanoComprimidoBytes; }

    public long getTamanoDescomprimidoBytes() { return tamanoDescomprimidoBytes; }
    public void setTamanoDescomprimidoBytes(long tamanoDescomprimidoBytes) { this.tamanoDescomprimidoBytes = tamanoDescomprimidoBytes; }

    public double getRatioCompresion() { return ratioCompresion; }
    public void setRatioCompresion(double ratioCompresion) { this.ratioCompresion = ratioCompresion; }

    public String getCadenaBits() { return cadenaBits; }
    public void setCadenaBits(String cadenaBits) { this.cadenaBits = cadenaBits; }

    public int getMPower() { return mPower; }
    public void setMPower(int mPower) { this.mPower = mPower; }

    public int getTotalBlocks() { return totalBlocks; }
    public void setTotalBlocks(int totalBlocks) { this.totalBlocks = totalBlocks; }

    public int getSingleErrorsCorrected() { return singleErrorsCorrected; }
    public void setSingleErrorsCorrected(int singleErrorsCorrected) { this.singleErrorsCorrected = singleErrorsCorrected; }

    public int getDoubleErrorsDetected() { return doubleErrorsDetected; }
    public void setDoubleErrorsDetected(int doubleErrorsDetected) { this.doubleErrorsDetected = doubleErrorsDetected; }

    public double getRedundancyPercentage() { return redundancyPercentage; }
    public void setRedundancyPercentage(double redundancyPercentage) { this.redundancyPercentage = redundancyPercentage; }

    public boolean isLocked() { return isLocked; }
    public void setLocked(boolean locked) { isLocked = locked; }

    public long getLockTimestamp() { return lockTimestamp; }
    public void setLockTimestamp(long lockTimestamp) { this.lockTimestamp = lockTimestamp; }

    public String getDatosBinariosBase64() { return datosBinariosBase64; }
    public void setDatosBinariosBase64(String datosBinariosBase64) { this.datosBinariosBase64 = datosBinariosBase64; }

    public String getNombreArchivoSugerido() { return nombreArchivoSugerido; }
    public void setNombreArchivoSugerido(String nombreArchivoSugerido) { this.nombreArchivoSugerido = nombreArchivoSugerido; }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String textoOriginal;
        private String textoComprimido;
        private Map<Character, Integer> frecuencias;
        private Map<Character, String> codigos;
        private double entropia;
        private double longitudMedia;
        private double eficiencia;
        private long tamanoOriginalBytes;
        private long tamanoComprimidoBytes;
        private long tamanoDescomprimidoBytes;
        private double ratioCompresion;
        private String cadenaBits;
        private int mPower;
        private int totalBlocks;
        private int singleErrorsCorrected;
        private int doubleErrorsDetected;
        private double redundancyPercentage;
        private boolean isLocked;
        private long lockTimestamp;
        private String datosBinariosBase64;
        private String nombreArchivoSugerido;

        public Builder textoOriginal(String textoOriginal) { this.textoOriginal = textoOriginal; return this; }
        public Builder textoComprimido(String textoComprimido) { this.textoComprimido = textoComprimido; return this; }
        public Builder frecuencias(Map<Character, Integer> frecuencias) { this.frecuencias = frecuencias; return this; }
        public Builder codigos(Map<Character, String> codigos) { this.codigos = codigos; return this; }
        public Builder entropia(double entropia) { this.entropia = entropia; return this; }
        public Builder longitudMedia(double longitudMedia) { this.longitudMedia = longitudMedia; return this; }
        public Builder eficiencia(double eficiencia) { this.eficiencia = eficiencia; return this; }
        public Builder tamanoOriginalBytes(long tamanoOriginalBytes) { this.tamanoOriginalBytes = tamanoOriginalBytes; return this; }
        public Builder tamanoComprimidoBytes(long tamanoComprimidoBytes) { this.tamanoComprimidoBytes = tamanoComprimidoBytes; return this; }
        public Builder tamanoDescomprimidoBytes(long tamanoDescomprimidoBytes) { this.tamanoDescomprimidoBytes = tamanoDescomprimidoBytes; return this; }
        public Builder ratioCompresion(double ratioCompresion) { this.ratioCompresion = ratioCompresion; return this; }
        public Builder cadenaBits(String cadenaBits) { this.cadenaBits = cadenaBits; return this; }
        public Builder mPower(int mPower) { this.mPower = mPower; return this; }
        public Builder totalBlocks(int totalBlocks) { this.totalBlocks = totalBlocks; return this; }
        public Builder singleErrorsCorrected(int singleErrorsCorrected) { this.singleErrorsCorrected = singleErrorsCorrected; return this; }
        public Builder doubleErrorsDetected(int doubleErrorsDetected) { this.doubleErrorsDetected = doubleErrorsDetected; return this; }
        public Builder redundancyPercentage(double redundancyPercentage) { this.redundancyPercentage = redundancyPercentage; return this; }
        public Builder isLocked(boolean isLocked) { this.isLocked = isLocked; return this; }
        public Builder lockTimestamp(long lockTimestamp) { this.lockTimestamp = lockTimestamp; return this; }
        public Builder datosBinariosBase64(String datosBinariosBase64) { this.datosBinariosBase64 = datosBinariosBase64; return this; }
        public Builder nombreArchivoSugerido(String nombreArchivoSugerido) { this.nombreArchivoSugerido = nombreArchivoSugerido; return this; }

        public PM3Response build() {
            return new PM3Response(textoOriginal, textoComprimido, frecuencias, codigos, entropia, longitudMedia, 
                                   eficiencia, tamanoOriginalBytes, tamanoComprimidoBytes, tamanoDescomprimidoBytes, 
                                   ratioCompresion, cadenaBits, mPower, totalBlocks, singleErrorsCorrected, 
                                   doubleErrorsDetected, redundancyPercentage, isLocked, lockTimestamp, 
                                   datosBinariosBase64, nombreArchivoSugerido);
        }
    }
}
