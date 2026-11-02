import PDFDocument from "pdfkit";

// ── Typography constants ───────────────────────────────────────────────────────

const MARGIN = 60;
const PAGE_WIDTH = 595.28;  // A4 width in points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  title:     "#1a1a2e",  // deep navy
  subtitle:  "#4a4a8a",  // muted indigo
  heading:   "#2d2d6e",  // section heading navy
  bullet:    "#4a4a8a",  // bullet point mark
  bodyText:  "#2c2c2c",  // near-black for body
  rule:      "#c0c0d8",  // light line
  footer:    "#9090a8",  // page number / footer
  accent:    "#5c5ce0",  // accent strip
};

const FONT = {
  regular: "Helvetica",
  bold:    "Helvetica-Bold",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Draw a coloured rectangle strip at the very top of a page (branding bar).
 */
function drawHeaderBar(doc) {
  doc.save()
    .rect(0, 0, PAGE_WIDTH, 6)
    .fill(COLORS.accent)
    .restore();
}

/**
 * Write the page number at the bottom centre of the current page.
 */
function drawPageNumber(doc) {
  const pageNum = doc.bufferedPageRange
    ? doc.bufferedPageRange().start + doc.bufferedPageRange().count
    : "—";

  doc.save()
    .fontSize(9)
    .font(FONT.regular)
    .fillColor(COLORS.footer)
    .text(
      `— ${pageNum} —`,
      MARGIN,
      doc.page.height - MARGIN + 10,
      { width: CONTENT_WIDTH, align: "center" }
    )
    .restore();
}

// ── Main generator ─────────────────────────────────────────────────────────────

/**
 * Generate a professional PDF document from structured JSON data.
 *
 * @param {{ title: string, subtitle: string, sections: Array<{ heading: string, points: string[] }> }} data
 * @returns {Promise<Buffer>} Resolves with the complete PDF buffer.
 */
export function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const { title, subtitle, sections } = data;

    // ── Create PDFDocument with buffered pages for page-numbering support ──────
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: title,
        Author: "NexusMind AI",
        Creator: "NexusMind PDF Agent",
      },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    // ── Cover / Title section ─────────────────────────────────────────────────

    drawHeaderBar(doc);

    // Add generous top padding before the title
    doc.moveDown(3);

    // Document title
    doc.font(FONT.bold)
      .fontSize(28)
      .fillColor(COLORS.title)
      .text(title, MARGIN, doc.y, { width: CONTENT_WIDTH, align: "center" });

    doc.moveDown(0.6);

    // Subtitle
    if (subtitle) {
      doc.font(FONT.regular)
        .fontSize(14)
        .fillColor(COLORS.subtitle)
        .text(subtitle, MARGIN, doc.y, { width: CONTENT_WIDTH, align: "center" });
    }

    doc.moveDown(1.2);

    // Decorative horizontal rule below the title block
    doc.save()
      .moveTo(MARGIN, doc.y)
      .lineTo(PAGE_WIDTH - MARGIN, doc.y)
      .lineWidth(1.5)
      .strokeColor(COLORS.rule)
      .stroke()
      .restore();

    doc.moveDown(1.5);

    // ── Sections ─────────────────────────────────────────────────────────────

    sections.forEach((section, idx) => {
      // Check available space; add a new page if less than 120 pts remain
      const spaceNeeded = 40 + section.points.length * 22;
      if (doc.y + spaceNeeded > doc.page.height - MARGIN - 30) {
        doc.addPage();
        drawHeaderBar(doc);
        doc.moveDown(1);
      }

      // Section number badge + heading
      const sectionLabel = `${idx + 1}.  ${section.heading}`;
      doc.font(FONT.bold)
        .fontSize(14)
        .fillColor(COLORS.heading)
        .text(sectionLabel, MARGIN, doc.y, { width: CONTENT_WIDTH });

      doc.moveDown(0.4);

      // Thin rule under the heading
      doc.save()
        .moveTo(MARGIN, doc.y)
        .lineTo(MARGIN + CONTENT_WIDTH * 0.4, doc.y)
        .lineWidth(1)
        .strokeColor(COLORS.rule)
        .stroke()
        .restore();

      doc.moveDown(0.5);

      // Bullet points
      section.points.forEach((point) => {
        // Guard: ensure we have room for this line
        if (doc.y > doc.page.height - MARGIN - 30) {
          doc.addPage();
          drawHeaderBar(doc);
          doc.moveDown(1);
        }

        const bulletX = MARGIN + 14;
        const textX   = MARGIN + 28;
        const textW   = CONTENT_WIDTH - 28;

        // Bullet mark
        doc.save()
          .font(FONT.bold)
          .fontSize(11)
          .fillColor(COLORS.bullet)
          .text("•", MARGIN, doc.y, { width: 14, lineBreak: false })
          .restore();

        // Point text (may wrap)
        const beforeY = doc.y;
        doc.font(FONT.regular)
          .fontSize(11)
          .fillColor(COLORS.bodyText)
          .text(point.trim(), textX, beforeY, { width: textW });

        doc.moveDown(0.35);
      });

      doc.moveDown(0.9);
    });

    // ── Page numbers (added after all content is written) ─────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.save()
        .fontSize(9)
        .font(FONT.regular)
        .fillColor(COLORS.footer)
        .text(
          `Page ${i - range.start + 1} of ${range.count}`,
          MARGIN,
          doc.page.height - MARGIN + 10,
          { width: CONTENT_WIDTH, align: "center" }
        )
        .restore();
    }

    doc.end();
  });
}
