/**
 * src/lib/firDocxGenerator.js — Unified Official State FIR Document Generator
 * 
 * Generates official state-specific DOCX First Information Reports directly
 * in the browser using the docx npm package. Zero dependency on Python microservices.
 * Works seamlessly in offline, development, and production environments.
 */

import {
  Document, Packer, Table, TableRow, TableCell,
  Paragraph, TextRun, WidthType, BorderStyle,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";
import { normalizeFIR } from "./firSchema";

// State-specific language header for official documents
const STATE_HEADERS = {
  "Tamil Nadu":        "தமிழ்நாடு காவல்துறை / TAMIL NADU POLICE",
  "Andhra Pradesh":    "ఆంధ్రప్రదేశ్ పోలీసు / ANDHRA PRADESH POLICE",
  "Telangana":         "తెలంగాణ పోలీసు / TELANGANA POLICE",
  "Karnataka":         "ಕರ್ನಾಟಕ ಪೋಲೀಸ್ / KARNATAKA POLICE",
  "Kerala":            "കേരള പോലീസ് / KERALA POLICE",
  "Maharashtra":       "महाराष्ट्र पोलीस / MAHARASHTRA POLICE",
  "Gujarat":           "ગુજરાત પોલીસ / GUJARAT POLICE",
  "Rajasthan":         "राजस्थान पुलिस / RAJASTHAN POLICE",
  "Uttar Pradesh":     "उत्तर प्रदेश पुलिस / UTTAR PRADESH POLICE",
  "West Bengal":       "পশ্চিমবঙ্গ পুলিশ / WEST BENGAL POLICE",
  "Bihar":             "बिहार पुलिस / BIHAR POLICE",
  "Madhya Pradesh":    "मध्यप्रदेश पुलिस / MADHYA PRADESH POLICE",
  "Punjab":            "ਪੰਜਾਬ ਪੁਲਿਸ / PUNJAB POLICE",
  "Odisha":            "ଓଡ଼ିଶା ପୋଲିସ / ODISHA POLICE",
  "Assam":             "অসম আৰক্ষী / ASSAM POLICE",
  "default":           "STATE POLICE DEPARTMENT / இந்திய காவல்துறை",
};

function formatDate(dateStr) {
  if (!dateStr) return "Not recorded";
  try {
    if (dateStr.includes("-")) {
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr) {
  if (!timeStr) return "Not recorded";
  try {
    if (timeStr.includes(":")) {
      const [h, m] = timeStr.split(":");
      const hr = parseInt(h, 10);
      const period = hr >= 12 ? "PM" : "AM";
      return `${hr % 12 || 12}:${m} ${period}`;
    }
    return timeStr;
  } catch {
    return timeStr;
  }
}

export async function generateAndDownloadFIRDocx(rawFIR, stationOverride, stateOverride) {
  const fir = normalizeFIR(rawFIR);

  const state = stateOverride || fir.location.state || "Tamil Nadu";
  const stateHeader = STATE_HEADERS[state] || STATE_HEADERS.default;
  const stationName = stationOverride?.name || fir.station.name || "REPORT Digital Police Station";
  const stationDistrict = stationOverride?.district || fir.location.city || "Headquarters";

  const bnsSections = fir.legal.suggestedSections || [];
  const bnsStr = bnsSections.length > 0 ? bnsSections.map(s => `§${s}`).join(", ") : "Under Investigation";

  const now = new Date();
  const createdDateStr = fir.metadata.createdAt ? formatDate(fir.metadata.createdAt.split("T")[0]) : formatDate(now.toISOString().split("T")[0]);
  const createdTimeStr = fir.metadata.createdAt ? formatTime(fir.metadata.createdAt.split("T")[1]?.slice(0, 5)) : formatTime(now.toTimeString().slice(0, 5));

  // Helper: create a 2-column key-value pair row
  const LVRow = (label, value, label2 = "", value2 = "") => new TableRow({
    children: [
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18 })] })],
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: String(value || "—"), size: 18 })] })],
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label2, bold: true, size: 18 })] })],
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: String(value2 || "—"), size: 18 })] })],
      }),
    ],
  });

  // Helper: full width row
  const FWRow = (label, value = "", bold = false) => new TableRow({
    children: [
      new TableCell({
        columnSpan: 4,
        width: { size: 100, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [
            new TextRun({ text: label + (value ? ":  " : ""), bold: true, size: bold ? 20 : 18 }),
            value ? new TextRun({ text: String(value), size: 18 }) : new TextRun(""),
          ],
        })],
      }),
    ],
  });

  const SectionHeader = (text) => new TableRow({
    children: [
      new TableCell({
        columnSpan: 4,
        shading: { fill: "1E3A5F" },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })],
        })],
      }),
    ],
  });

  const gpsCoords = (fir.location.latitude && fir.location.longitude)
    ? `${fir.location.latitude.toFixed(5)}° N, ${fir.location.longitude.toFixed(5)}° E`
    : "Not captured";

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:          { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      bottom:       { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      left:         { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      right:        { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
      insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
    },
    rows: [
      // 1. Header Banner
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            shading: { fill: "0F2035" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: stateHeader, bold: true, color: "93C5FD", size: 18 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "FIRST INFORMATION REPORT / முதல் தகவல் அறிக்கை", bold: true, color: "FFFFFF", size: 24 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "(Under Section 173 Bharatiya Nagarik Suraksha Sanhita 2023 / Sec 154 Cr.P.C.)", color: "CBD5E1", size: 16 })],
              }),
            ],
          }),
        ],
      }),

      // 2. Section 1: Station & Administrative Details
      SectionHeader("1. POLICE STATION & RECORD PARTICULARS"),
      LVRow("District / மாவட்டம்:", stationDistrict, "Police Station / காவல் நிலையம்:", stationName),
      LVRow("FIR Number / எண்:", fir.id, "Year / வருடம்:", String(now.getFullYear())),
      LVRow("Date of Report / பதிவு தேதி:", createdDateStr, "Time of Report / பதிவு நேரம்:", createdTimeStr),

      // 3. Section 2: Acts & Sections
      SectionHeader("2. ACTS AND SECTIONS (LEGAL CLASSIFICATION)"),
      LVRow("Primary Act:", "Bharatiya Nyaya Sanhita (BNS) 2023", "Sections / பிரிவுகள்:", bnsStr),
      LVRow("Crime Category:", fir.incident.crimeType || "Unclassified", "Status:", fir.status.toUpperCase()),

      // 4. Section 3: Occurrence of Offence
      SectionHeader("3. OCCURRENCE OF OFFENCE / குற்ற நிகழ்வு"),
      LVRow("Date of Occurrence:", formatDate(fir.incident.date), "Time of Occurrence:", formatTime(fir.incident.time)),
      FWRow("Location of Incident:", fir.location.address || fir.location.city || "Not recorded"),
      LVRow("Area / Suburb:", fir.location.area || "—", "City / District:", fir.location.city || "—"),
      LVRow("State / மாநிலம்:", state, "GPS Coordinates:", gpsCoords),

      // 5. Section 4: Complainant Details
      SectionHeader("4. COMPLAINANT / INFORMANT PARTICULARS"),
      LVRow("Full Name / பெயர்:", fir.complainant.name, "Phone / தொலைபேசி:", fir.complainant.phone),
      LVRow("Age / வயது:", fir.complainant.age ? `${fir.complainant.age} yrs` : "—", "Gender / பாலினம்:", fir.complainant.gender || "—"),
      LVRow("Email / மின்னஞ்சல்:", fir.complainant.email || "—", "Language Spoken:", fir.incident.language || "English"),
      FWRow("Residential Address:", fir.complainant.address || "Not recorded"),

      // 6. Section 5: Suspect & Physical Evidence
      SectionHeader("5. SUSPECT & EVIDENCE PARTICULARS"),
      FWRow("Suspect Description:", fir.involved.suspects || "Unidentified / Under investigation"),
      LVRow("Stolen Property:", fir.evidence.stolenItems || "Nil", "Weapon Used:", fir.evidence.weaponUsed || "None"),
      LVRow("Vehicle Number:", fir.evidence.vehicleNumber || "None", "Witnesses:", fir.involved.witnesses || "None"),
      LVRow("Evidence Photos Attached:", `${fir.evidence.photos.length} item(s)`, "Suspect Sketch:", fir.evidence.sketchUrl ? "Attached" : "None"),

      // 7. Section 6: Full Narrative Statement
      SectionHeader("6. STATEMENT OF COMPLAINANT / முழு புகார் விவரம்"),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            width: { size: 100, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: fir.incident.description || fir.incident.originalStatement || "No narrative recorded.",
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      // 8. Signatures Block
      SectionHeader("7. SIGNATURES & VERIFICATION"),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Signature / Thumb Impression of Informant:\n\n", bold: true, size: 18 }),
                  new TextRun({ text: `Name: ${fir.complainant.name || "Complainant"}\n`, size: 18 }),
                  new TextRun({ text: `Date: ${createdDateStr}\n\n`, size: 18 }),
                  new TextRun({ text: "____________________________________", size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 2,
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Station House Officer / Investigating Officer:\n\n", bold: true, size: 18 }),
                  new TextRun({ text: `Station: ${stationName}\n`, size: 18 }),
                  new TextRun({ text: `Rank: Inspector of Police\n\n`, size: 18 }),
                  new TextRun({ text: "____________________________________", size: 18 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children: [table],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeId = (fir.id || "FIR").replace(/[\/\\:]/g, "-");
  const safeState = state.replace(/\s+/g, "_");
  const filename = `Official_FIR_${safeId}_${safeState}.docx`;

  saveAs(blob, filename);

  return { success: true, filename };
}
