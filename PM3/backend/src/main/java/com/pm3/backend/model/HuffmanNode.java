package com.pm3.backend.model;

public class HuffmanNode implements Comparable<HuffmanNode> {
    private Character caracter;
    private int frecuencia;
    private HuffmanNode izquierdo;
    private HuffmanNode derecho;

    public HuffmanNode(Character caracter, int frecuencia) {
        this.caracter = caracter;
        this.frecuencia = frecuencia;
    }

    public HuffmanNode(Character caracter, int frecuencia, HuffmanNode izquierdo, HuffmanNode derecho) {
        this.caracter = caracter;
        this.frecuencia = frecuencia;
        this.izquierdo = izquierdo;
        this.derecho = derecho;
    }

    public boolean esHoja() {
        return izquierdo == null && derecho == null;
    }

    public Character getCaracter() {
        return caracter;
    }

    public void setCaracter(Character caracter) {
        this.caracter = caracter;
    }

    public int getFrecuencia() {
        return frecuencia;
    }

    public void setFrecuencia(int frecuencia) {
        this.frecuencia = frecuencia;
    }

    public HuffmanNode getIzquierdo() {
        return izquierdo;
    }

    public void setIzquierdo(HuffmanNode izquierdo) {
        this.izquierdo = izquierdo;
    }

    public HuffmanNode getDerecho() {
        return derecho;
    }

    public void setDerecho(HuffmanNode derecho) {
        this.derecho = derecho;
    }

    @Override
    public int compareTo(HuffmanNode o) {
        return Integer.compare(this.frecuencia, o.frecuencia);
    }
}
