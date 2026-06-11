#!/usr/bin/env python3
"""Gera os ícones PNG da extensão (16/48/128) sem dependências externas.

Desenha um "radar" simplificado: fundo indigo (#6366f1) com anéis e um
ponto de destaque verde (#10b981), remetendo à análise de sites.
Uso: python3 tools/gerar-icones.py
"""
import os
import struct
import zlib

BG = (15, 17, 23)        # --bg-primary
RING = (99, 102, 241)    # indigo
DOT = (16, 185, 129)     # verde


def pixel(x, y, size):
    cx = cy = (size - 1) / 2
    r = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
    raio_max = size * 0.48
    if r > raio_max:
        return None  # transparente (cantos arredondados)
    # anéis concêntricos
    for frac in (0.95, 0.65, 0.35):
        if abs(r - raio_max * frac) < max(1.0, size * 0.04):
            return RING
    # ponto de destaque no quadrante superior direito
    dx, dy = x - (cx + size * 0.18), y - (cy - size * 0.18)
    if (dx * dx + dy * dy) ** 0.5 < size * 0.10:
        return DOT
    return BG


def gerar(size, caminho):
    linhas = b""
    for y in range(size):
        linha = b"\x00"
        for x in range(size):
            p = pixel(x, y, size)
            if p is None:
                linha += b"\x00\x00\x00\x00"
            else:
                linha += bytes(p) + b"\xff"
        linhas += linha

    def chunk(tipo, dados):
        c = tipo + dados
        return struct.pack(">I", len(dados)) + c + struct.pack(">I", zlib.crc32(c))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(linhas, 9)) + chunk(b"IEND", b""))
    with open(caminho, "wb") as f:
        f.write(png)
    print(f"gerado: {caminho}")


if __name__ == "__main__":
    base = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(base, exist_ok=True)
    for s in (16, 48, 128):
        gerar(s, os.path.join(base, f"icon{s}.png"))
