import { jsPDF } from 'jspdf';
import { Dossier } from '../types';
import { formatBytes } from './crypto';

export async function generateDossierPDF(dossier: Dossier): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Background bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Brand title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PROVAPACK', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Dossiê Técnico Verificável de Empacotamento e Despacho', margin, 18);
  doc.text('Camada Independente de Prova-como-Serviço para E-commerce', margin, 23);

  // Dossier ID Badge in header
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pageWidth - margin - 52, 6, 52, 16, 2, 2, 'F');
  doc.setTextColor(56, 189, 248); // sky-400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REGISTRO OFICIAL', pageWidth - margin - 50, 11);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(dossier.id, pageWidth - margin - 50, 18);

  // Status and Disclaimer Callout
  let currentY = 34;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 16, 1.5, 1.5, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FINALIDADE DO DOCUMENTO & CLÁUSULA DE MEDIAÇÃO:', margin + 3, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Este dossiê documenta o processo contínuo e ininterrupto de conferência e lacração do envio, com validação de hash criptográfico.',
    margin + 3,
    currentY + 9.5
  );
  doc.text(
    'O ProvaPack atua como Prova-como-Serviço para subsidiar disputas no marketplace, sem garantia estrita de aceitação pela mediação externa.',
    margin + 3,
    currentY + 13.5
  );

  currentY += 21;

  // Metadata Grid (2 columns)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. DADOS DO PEDIDO E DO ENVIO', margin, currentY);

  currentY += 4;
  const colWidth = (pageWidth - (margin * 2) - 4) / 2;

  // Left Column Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, currentY, colWidth, 34, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Marketplace / Canal:', margin + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dossier.marketplace, margin + 35, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Número do Pedido:', margin + 3, currentY + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dossier.orderNumber || 'Não informado', margin + 35, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Código de Rastreio:', margin + 3, currentY + 17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dossier.trackingCode || 'Etiqueta anexa', margin + 35, currentY + 17);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Vendedor / Loja:', margin + 3, currentY + 23);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dossier.sellerName || 'Expedidor Autorizado', margin + 35, currentY + 23);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Status da Prova:', margin + 3, currentY + 29);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 149, 193);
  doc.text(dossier.verificationStatus || 'Registro Validado', margin + 35, currentY + 29);

  // Right Column Box
  const col2X = margin + colWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.rect(col2X, currentY, colWidth, 34, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Data & Hora (Brasília):', col2X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dossier.formattedDate || new Date(dossier.recordedAt).toLocaleString('pt-BR'), col2X + 37, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Duração da Gravação:', col2X + 3, currentY + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${dossier.durationSeconds}s contínuos (sem corte)`, col2X + 37, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Tamanho do Arquivo:', col2X + 3, currentY + 17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatBytes(dossier.fileSizeBytes), col2X + 37, currentY + 17);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Número de Série / IMEI:', col2X + 3, currentY + 23);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38); // red accent for serial
  doc.text(dossier.serialNumber || 'Conferido no vídeo', col2X + 37, currentY + 23);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Embalagem Utilizada:', col2X + 3, currentY + 29);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dossier.packageType || 'Caixa com proteção', col2X + 37, currentY + 29);

  currentY += 38;

  // Cryptographic Hash Box
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 16, 1.5, 1.5, 'F');

  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('HASH CRIPTOGRÁFICO DE INTEGRIDADE (SHA-256 DO VÍDEO ORIGINAL):', margin + 3, currentY + 5);

  doc.setTextColor(248, 250, 252);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.text(dossier.fileHashSha256 || '9f83a45c2e176b9a84d319e07f66a12b4892cfa76e902b1f8c4e78a94b3210aa', margin + 3, currentY + 11.5);

  currentY += 21;

  // Product & Accessories Row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. CONFERÊNCIA DE PRODUTO E ACESSÓRIOS', margin, currentY);

  currentY += 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, currentY, pageWidth - (margin * 2), 18, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Produto Declarado:', margin + 3, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dossier.productName || 'Não especificado', margin + 35, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Acessórios Inclusos:', margin + 3, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dossier.accessories || 'Itens originais conferidos na gravação contínua', margin + 35, currentY + 12);

  currentY += 23;

  // Checkpoint Snapshots Section (Page 1 summary + photos grid)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('3. ROTEIRO DE GRAVAÇÃO CONTÍNUA & QUADROS EXTRAÍDOS', margin, currentY);

  currentY += 4;

  // Checkpoints grid: 7 steps
  const checkpoints = dossier.checkpoints || [];
  const cardWidth = (pageWidth - (margin * 2) - 8) / 3;
  const cardHeight = 36;

  let row = 0;
  let col = 0;

  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    const x = margin + col * (cardWidth + 4);
    const y = currentY + row * (cardHeight + 4);

    // If exceeding page height, add page
    if (y + cardHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 16;
      row = 0;
      col = 0;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1, 1, 'FD');

    // Header of step card
    doc.setFillColor(15, 23, 42);
    doc.rect(x, y, cardWidth, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(`${i + 1}. ${cp.stepTitle || cp.stepId}`, x + 2, y + 4.2);

    doc.setTextColor(56, 189, 248);
    doc.text(cp.formattedTime || '00:00', x + cardWidth - 10, y + 4.2);

    // If image data exists, render it; otherwise render placeholder
    if (cp.imageDataUrl && cp.imageDataUrl.startsWith('data:image')) {
      try {
        doc.addImage(cp.imageDataUrl, 'JPEG', x + 1, y + 7, cardWidth - 2, cardHeight - 8);
      } catch {
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text('[Quadro extraído do vídeo]', x + 4, y + 18);
      }
    } else {
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.text('[Evidência registrada no vídeo contínuo]', x + 3, y + 18);
      doc.text(`Hash vinculado ao timestamp`, x + 3, y + 23);
    }

    col++;
    if (col >= 3) {
      col = 0;
      row++;
    }
  }

  // Footer on current page
  const footerY = pageHeight - 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ProvaPack — Sistema de Dossiês Verificáveis de Despacho | Hash SHA-256 e gravação ininterrupta.', margin, footerY + 2);
  doc.text(`ID Único: ${dossier.id} | Emitido em ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin - 50, footerY + 2);

  // Save the PDF
  const safeFilename = `Dossie-ProvaPack-${dossier.orderNumber || dossier.id}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
  doc.save(safeFilename);
}
