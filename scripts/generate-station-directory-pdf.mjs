// scripts/generate-station-directory-pdf.mjs
// Generates the comprehensive, official Police Station Directory PDF
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import STATIONS from '../src/utils/policeStations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateDirectoryPDF() {
  console.log('Generating Official Police Station Credentials Directory PDF...');
  const doc = await PDFDocument.create();
  
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_WIDTH = 595.28; // A4 portrait
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 36;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  // Colors
  const primaryNavy = rgb(15 / 255, 23 / 255, 42 / 255);       // Slate 900
  const headerBlue = rgb(30 / 255, 58 / 255, 138 / 255);       // Blue 900
  const brandBlue = rgb(37 / 255, 99 / 255, 235 / 255);        // Blue 600
  const textDark = rgb(30 / 255, 41 / 255, 59 / 255);          // Slate 800
  const textMuted = rgb(100 / 255, 116 / 255, 139 / 255);      // Slate 500
  const borderGrey = rgb(226 / 255, 232 / 255, 240 / 255);     // Slate 200
  const bgRowAlt = rgb(248 / 255, 250 / 255, 252 / 255);       // Slate 50
  const highlightBg = rgb(238 / 255, 242 / 255, 255 / 255);    // Indigo 50
  const highlightBorder = rgb(199 / 255, 210 / 255, 254 / 255); // Indigo 200
  const badgeGreen = rgb(16 / 255, 185 / 255, 129 / 255);

  let pageNumber = 1;

  function addFooter(page, currentP, totalP = null) {
    page.drawLine({
      start: { x: MARGIN, y: 30 },
      end: { x: PAGE_WIDTH - MARGIN, y: 30 },
      thickness: 0.5,
      color: borderGrey,
    });
    page.drawText('REPORT v2.0 — Official Jurisdictional Police Dispatch Directory | BNSS 2023 & IT Act 2000', {
      x: MARGIN,
      y: 18,
      size: 7,
      font: helvetica,
      color: textMuted,
    });
    page.drawText(`Page ${currentP}`, {
      x: PAGE_WIDTH - MARGIN - 35,
      y: 18,
      size: 7,
      font: helveticaBold,
      color: textMuted,
    });
  }

  // =========================================================================
  // PAGE 1: COVER & EXECUTIVE PROTOCOL DIRECTORY
  // =========================================================================
  const cover = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  
  // Top Banner
  cover.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 120,
    width: PAGE_WIDTH,
    height: 120,
    color: primaryNavy,
  });

  cover.drawText('TAMIL NADU POLICE & NATIONAL DISPATCH NETWORK', {
    x: MARGIN,
    y: PAGE_HEIGHT - 45,
    size: 13,
    font: helveticaBold,
    color: rgb(147 / 255, 197 / 255, 253 / 255), // light blue
  });

  cover.drawText('POLICE COMMAND TERMINAL ACCESS DIRECTORY', {
    x: MARGIN,
    y: PAGE_HEIGHT - 72,
    size: 20,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  cover.drawText('Official Station Jurisdiction Codes, Duty Badges & Station Security Keys', {
    x: MARGIN,
    y: PAGE_HEIGHT - 95,
    size: 10,
    font: helvetica,
    color: rgb(203 / 255, 213 / 255, 225 / 255),
  });

  // Notice Box
  let y = PAGE_HEIGHT - 150;
  cover.drawRectangle({
    x: MARGIN,
    y: y - 75,
    width: CONTENT_WIDTH,
    height: 80,
    color: bgRowAlt,
    borderColor: brandBlue,
    borderWidth: 1,
  });

  cover.drawText('STATUTORY SECURITY NOTICE & DISPATCH SPECIFICATION', {
    x: MARGIN + 14,
    y: y - 16,
    size: 9,
    font: helveticaBold,
    color: headerBlue,
  });

  cover.drawText(
    'This directory provides official credentials for jurisdictional station terminals across Tamil Nadu\n' +
    'and India under Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023 and the Information Technology Act 2000.\n' +
    'Officers and evaluators can authenticate into any jurisdictional command terminal to review live SOS dispatches,\n' +
    'inspect AI-transcribed FIR drafts, and acknowledge citizen emergency broadcasts in real-time.',
    {
      x: MARGIN + 14,
      y: y - 32,
      size: 8,
      font: helvetica,
      color: textDark,
      lineHeight: 12,
    }
  );

  y -= 95;

  // Authentication Rules Card
  cover.drawRectangle({
    x: MARGIN,
    y: y - 110,
    width: CONTENT_WIDTH,
    height: 115,
    color: highlightBg,
    borderColor: highlightBorder,
    borderWidth: 1,
  });

  cover.drawText('OFFICIAL CREDENTIAL STRUCTURE & LOGIN INSTRUCTIONS', {
    x: MARGIN + 14,
    y: y - 18,
    size: 10,
    font: helveticaBold,
    color: headerBlue,
  });

  const instructions = [
    { label: 'Portal URL:', val: 'https://report-fresh-five.vercel.app/police-login  (or /police-login locally)' },
    { label: 'Station Code:', val: 'Official 11-character jurisdiction code (e.g., TN-ARC-B0085, TN-CHN-001)' },
    { label: 'Officer Badge:', val: 'SHO-4102, IO-DUTY, or SHO-DUTY (Default fallback badge: SHO-DUTY)' },
    { label: 'Station Security Key:', val: 'Police@<STATION_CODE> (e.g., Police@TN-ARC-B0085) or Master: TN-POLICE@2026' },
    { label: 'Legacy Notice:', val: 'Insecure default "police123" is disabled per Phase 1.1 hardening standards.' },
  ];

  let iy = y - 36;
  for (const item of instructions) {
    cover.drawText(item.label, {
      x: MARGIN + 14,
      y: iy,
      size: 8.5,
      font: helveticaBold,
      color: primaryNavy,
    });
    cover.drawText(item.val, {
      x: MARGIN + 130,
      y: iy,
      size: 8.5,
      font: helvetica,
      color: textDark,
    });
    iy -= 15;
  }

  y -= 135;

  // PRIORITY TEST STATIONS TABLE
  cover.drawText('FEATURED & ACTIVE DEMONSTRATION STATIONS (QUICK REFERENCE)', {
    x: MARGIN,
    y: y,
    size: 11,
    font: helveticaBold,
    color: primaryNavy,
  });

  y -= 10;

  const keyStations = [
    {
      code: 'TN-ARC-B0085',
      name: 'West Police Station',
      district: 'Arcot, Tamil Nadu',
      badge: 'SHO-4102',
      key: 'Police@TN-ARC-B0085',
      note: '★ Active SOS Dispatch Nearest Station',
    },
    {
      code: 'TN-ARC-B0082',
      name: 'North Police Station',
      district: 'Arcot, Tamil Nadu',
      badge: 'SHO-4102',
      key: 'Police@TN-ARC-B0082',
      note: 'Arcot Jurisdiction Division',
    },
    {
      code: 'TN-RAN-B0091',
      name: 'North Police Station',
      district: 'Ranipet, Tamil Nadu',
      badge: 'SHO-DUTY',
      key: 'Police@TN-RAN-B0091',
      note: 'Ranipet Sub-Division',
    },
    {
      code: 'TN-VLR-002',
      name: 'Katpadi Police Station',
      district: 'Vellore, Tamil Nadu',
      badge: 'SHO-4102',
      key: 'Police@TN-VLR-002',
      note: 'Vellore Urban Sub-Division',
    },
    {
      code: 'TN-CHN-001',
      name: 'Central Police Station',
      district: 'Chennai, Tamil Nadu',
      badge: 'SHO-4102',
      key: 'Police@TN-CHN-001',
      note: 'Greater Chennai Police HQ',
    },
    {
      code: 'TN-MDU-001',
      name: 'Town Police Station',
      district: 'Madurai, Tamil Nadu',
      badge: 'SHO-DUTY',
      key: 'Police@TN-MDU-001',
      note: 'Madurai City South Division',
    },
    {
      code: 'TN-CBE-001',
      name: 'Central Police Station',
      district: 'Coimbatore, Tamil Nadu',
      badge: 'SHO-DUTY',
      key: 'Police@TN-CBE-001',
      note: 'Coimbatore City Division',
    },
    {
      code: 'TN-SLM-001',
      name: 'Town Police Station',
      district: 'Salem, Tamil Nadu',
      badge: 'SHO-DUTY',
      key: 'Police@TN-SLM-001',
      note: 'Salem Central Division',
    },
  ];

  // Draw Table Header
  const colX = [MARGIN, MARGIN + 95, MARGIN + 215, MARGIN + 310, MARGIN + 380, MARGIN + 490];
  
  cover.drawRectangle({
    x: MARGIN,
    y: y - 18,
    width: CONTENT_WIDTH,
    height: 18,
    color: primaryNavy,
  });

  cover.drawText('STATION CODE', { x: colX[0] + 4, y: y - 13, size: 7.5, font: helveticaBold, color: rgb(1, 1, 1) });
  cover.drawText('STATION NAME', { x: colX[1] + 4, y: y - 13, size: 7.5, font: helveticaBold, color: rgb(1, 1, 1) });
  cover.drawText('DISTRICT', { x: colX[2] + 4, y: y - 13, size: 7.5, font: helveticaBold, color: rgb(1, 1, 1) });
  cover.drawText('BADGE ID', { x: colX[3] + 4, y: y - 13, size: 7.5, font: helveticaBold, color: rgb(1, 1, 1) });
  cover.drawText('SECURITY KEY', { x: colX[4] + 4, y: y - 13, size: 7.5, font: helveticaBold, color: rgb(1, 1, 1) });

  y -= 18;

  for (let i = 0; i < keyStations.length; i++) {
    const stn = keyStations[i];
    const isHighlight = i === 0; // TN-ARC-B0085
    const rowHeight = 22;

    cover.drawRectangle({
      x: MARGIN,
      y: y - rowHeight,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: isHighlight ? rgb(254 / 255, 243 / 255, 199 / 255) : (i % 2 === 0 ? bgRowAlt : rgb(1, 1, 1)),
      borderColor: isHighlight ? rgb(245 / 255, 158 / 255, 11 / 255) : borderGrey,
      borderWidth: isHighlight ? 1 : 0.5,
    });

    cover.drawText(stn.code, {
      x: colX[0] + 4,
      y: y - 14,
      size: 8,
      font: helveticaBold,
      color: isHighlight ? rgb(180 / 255, 83 / 255, 9 / 255) : brandBlue,
    });

    cover.drawText(stn.name, {
      x: colX[1] + 4,
      y: y - 14,
      size: 8,
      font: helveticaBold,
      color: textDark,
    });

    cover.drawText(stn.district, {
      x: colX[2] + 4,
      y: y - 14,
      size: 7.5,
      font: helvetica,
      color: textMuted,
    });

    cover.drawText(stn.badge, {
      x: colX[3] + 4,
      y: y - 14,
      size: 8,
      font: helveticaBold,
      color: textDark,
    });

    cover.drawText(stn.key, {
      x: colX[4] + 4,
      y: y - 14,
      size: 7.5,
      font: helveticaBold,
      color: isHighlight ? rgb(180 / 255, 83 / 255, 9 / 255) : primaryNavy,
    });

    y -= rowHeight;
  }

  y -= 15;

  // Master jurisdictional key box
  cover.drawRectangle({
    x: MARGIN,
    y: y - 40,
    width: CONTENT_WIDTH,
    height: 40,
    color: rgb(240 / 255, 253 / 255, 244 / 255), // emerald 50
    borderColor: rgb(134 / 255, 239 / 255, 172 / 255),
    borderWidth: 1,
  });

  cover.drawText('UNIVERSAL STATE MASTER KEY:', {
    x: MARGIN + 12,
    y: y - 16,
    size: 8.5,
    font: helveticaBold,
    color: rgb(22 / 255, 101 / 255, 52 / 255),
  });

  cover.drawText('TN-POLICE@2026', {
    x: MARGIN + 180,
    y: y - 16,
    size: 10,
    font: helveticaBold,
    color: rgb(21 / 255, 128 / 255, 61 / 255),
  });

  cover.drawText('Unlocks any Tamil Nadu jurisdictional station for duty inspection & evaluation testing.', {
    x: MARGIN + 12,
    y: y - 30,
    size: 8,
    font: helvetica,
    color: rgb(21 / 255, 128 / 255, 61 / 255),
  });

  addFooter(cover, pageNumber++);

  // =========================================================================
  // PAGES 2+: COMPLETE TAMIL NADU STATION DIRECTORY (577 Stations)
  // =========================================================================
  const tnStations = STATIONS.filter(s => s.state === 'Tamil Nadu')
    .sort((a, b) => {
      if (a.district !== b.district) return a.district.localeCompare(b.district);
      return a.code.localeCompare(b.code);
    });

  const ROWS_PER_PAGE = 36;
  const ROW_HEIGHT = 18;

  for (let i = 0; i < tnStations.length; i += ROWS_PER_PAGE) {
    const chunk = tnStations.slice(i, i + ROWS_PER_PAGE);
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    let py = PAGE_HEIGHT - MARGIN;

    // Header
    page.drawText('TAMIL NADU POLICE JURISDICTIONAL DIRECTORY', {
      x: MARGIN,
      y: py,
      size: 12,
      font: helveticaBold,
      color: primaryNavy,
    });

    page.drawText(`Stations ${i + 1} to ${Math.min(i + ROWS_PER_PAGE, tnStations.length)} of ${tnStations.length} (Arcot, Chennai, Vellore, Madurai, etc.)`, {
      x: MARGIN,
      y: py - 14,
      size: 8,
      font: helvetica,
      color: textMuted,
    });

    py -= 28;

    // Table Header
    page.drawRectangle({
      x: MARGIN,
      y: py - 16,
      width: CONTENT_WIDTH,
      height: 16,
      color: primaryNavy,
    });

    const cX = [MARGIN, MARGIN + 90, MARGIN + 225, MARGIN + 325, MARGIN + 395];

    page.drawText('STATION CODE', { x: cX[0] + 4, y: py - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText('STATION NAME', { x: cX[1] + 4, y: py - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText('DISTRICT', { x: cX[2] + 4, y: py - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText('BADGE ID', { x: cX[3] + 4, y: py - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText('STATION SECURITY KEY', { x: cX[4] + 4, y: py - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });

    py -= 16;

    for (let r = 0; r < chunk.length; r++) {
      const stn = chunk[r];
      const isWestArcot = stn.code === 'TN-ARC-B0085';
      const key = `Police@${stn.code}`;
      const badge = isWestArcot ? 'SHO-4102' : 'SHO-DUTY';

      page.drawRectangle({
        x: MARGIN,
        y: py - ROW_HEIGHT,
        width: CONTENT_WIDTH,
        height: ROW_HEIGHT,
        color: isWestArcot
          ? rgb(254 / 255, 243 / 255, 199 / 255)
          : (r % 2 === 0 ? bgRowAlt : rgb(1, 1, 1)),
        borderColor: isWestArcot ? rgb(245 / 255, 158 / 255, 11 / 255) : borderGrey,
        borderWidth: isWestArcot ? 1 : 0.5,
      });

      page.drawText(stn.code, {
        x: cX[0] + 4,
        y: py - 12,
        size: 7.5,
        font: helveticaBold,
        color: isWestArcot ? rgb(180 / 255, 83 / 255, 9 / 255) : brandBlue,
      });

      page.drawText((stn.name || '').slice(0, 26), {
        x: cX[1] + 4,
        y: py - 12,
        size: 7.5,
        font: helvetica,
        color: textDark,
      });

      page.drawText((stn.district || '').slice(0, 18), {
        x: cX[2] + 4,
        y: py - 12,
        size: 7.5,
        font: helvetica,
        color: textMuted,
      });

      page.drawText(badge, {
        x: cX[3] + 4,
        y: py - 12,
        size: 7.5,
        font: helveticaBold,
        color: textDark,
      });

      page.drawText(key, {
        x: cX[4] + 4,
        y: py - 12,
        size: 7,
        font: helveticaBold,
        color: isWestArcot ? rgb(180 / 255, 83 / 255, 9 / 255) : primaryNavy,
      });

      py -= ROW_HEIGHT;
    }

    addFooter(page, pageNumber++);
  }

  // =========================================================================
  // PAGE: NATIONAL JURISDICTIONS DIRECTORY (Summary across All States)
  // =========================================================================
  const nationalPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let ny = PAGE_HEIGHT - MARGIN;

  nationalPage.drawText('NATIONAL JURISDICTIONAL MASTER CREDENTIALS (ALL STATES)', {
    x: MARGIN,
    y: ny,
    size: 12,
    font: helveticaBold,
    color: primaryNavy,
  });

  nationalPage.drawText('Standardized jurisdictional keys for all 31 States & Union Territories (3,447 total stations)', {
    x: MARGIN,
    y: ny - 14,
    size: 8,
    font: helvetica,
    color: textMuted,
  });

  ny -= 30;

  const states = [...new Set(STATIONS.map(s => s.state))].sort();

  nationalPage.drawRectangle({
    x: MARGIN,
    y: ny - 16,
    width: CONTENT_WIDTH,
    height: 16,
    color: primaryNavy,
  });

  const ncX = [MARGIN, MARGIN + 140, MARGIN + 230, MARGIN + 330, MARGIN + 430];
  nationalPage.drawText('STATE / UT', { x: ncX[0] + 4, y: ny - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });
  nationalPage.drawText('TOTAL STATIONS', { x: ncX[1] + 4, y: ny - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });
  nationalPage.drawText('DEFAULT BADGE', { x: ncX[2] + 4, y: ny - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });
  nationalPage.drawText('STATION KEY FORMAT', { x: ncX[3] + 4, y: ny - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });
  nationalPage.drawText('STATE MASTER KEY', { x: ncX[4] + 4, y: ny - 12, size: 7, font: helveticaBold, color: rgb(1, 1, 1) });

  ny -= 16;

  for (let sIdx = 0; sIdx < states.length; sIdx++) {
    const stName = states[sIdx];
    const count = STATIONS.filter(s => s.state === stName).length;
    const sample = STATIONS.find(s => s.state === stName);
    const prefix = sample ? sample.code.split('-')[0] : 'IN';
    const stateKey = `${prefix}-POLICE@2026`;

    nationalPage.drawRectangle({
      x: MARGIN,
      y: ny - 18,
      width: CONTENT_WIDTH,
      height: 18,
      color: sIdx % 2 === 0 ? bgRowAlt : rgb(1, 1, 1),
      borderColor: borderGrey,
      borderWidth: 0.5,
    });

    nationalPage.drawText(stName, {
      x: ncX[0] + 4,
      y: ny - 12,
      size: 7.5,
      font: helveticaBold,
      color: textDark,
    });

    nationalPage.drawText(`${count} Stations`, {
      x: ncX[1] + 4,
      y: ny - 12,
      size: 7.5,
      font: helvetica,
      color: textMuted,
    });

    nationalPage.drawText('SHO-DUTY', {
      x: ncX[2] + 4,
      y: ny - 12,
      size: 7.5,
      font: helveticaBold,
      color: textDark,
    });

    nationalPage.drawText('Police@<CODE>', {
      x: ncX[3] + 4,
      y: ny - 12,
      size: 7.5,
      font: helvetica,
      color: brandBlue,
    });

    nationalPage.drawText(stateKey, {
      x: ncX[4] + 4,
      y: ny - 12,
      size: 7.5,
      font: helveticaBold,
      color: primaryNavy,
    });

    ny -= 18;
  }

  addFooter(nationalPage, pageNumber++);

  // Save PDF bytes
  const pdfBytes = await doc.save();
  
  // Output locations:
  // 1. Root directory
  const rootPath = path.resolve(__dirname, '..', 'POLICE_STATION_CREDENTIALS_DIRECTORY.pdf');
  fs.writeFileSync(rootPath, pdfBytes);
  console.log(`Saved root PDF: ${rootPath} (${pdfBytes.length} bytes, ${pageNumber - 1} pages)`);

  // 2. Public directory for web download
  const publicPath = path.resolve(__dirname, '..', 'public', 'POLICE_STATION_CREDENTIALS_DIRECTORY.pdf');
  fs.writeFileSync(publicPath, pdfBytes);
  console.log(`Saved web-downloadable PDF: ${publicPath}`);

  return { rootPath, publicPath, pages: pageNumber - 1, bytes: pdfBytes.length };
}

generateDirectoryPDF().catch(console.error);
