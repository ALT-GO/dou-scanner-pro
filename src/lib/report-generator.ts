import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, HeadingLevel, TableOfContents } from 'docx';
import { saveAs } from 'file-saver';
import { buildHighlightRegex, COMPETITORS } from './keywords';

interface Publication {
  id: string;
  publication_type: string;
  section: string;
  organ: string | null;
  object_text: string | null;
  full_text: string;
  state: string | null;
  is_relevant: boolean;
  competitor_match: string | null;
}

const ACCENT_COLOR = '1B3A5C';
const LIGHT_ACCENT = 'E8F0F8';
const DIVIDER_COLOR = 'B0C4D8';
const MUTED_COLOR = '666666';

interface RunProps {
  bold?: boolean;
  italics?: boolean;
  color?: string;
}

function highlightTextRuns(text: string, baseFontSize: number, baseProps?: RunProps): TextRun[] {
  const regex = buildHighlightRegex();
  const runs: TextRun[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({
        text: text.slice(lastIndex, match.index),
        size: baseFontSize,
        font: 'Arial',
        ...(baseProps || {}),
      }));
    }
    const isCompetitor = COMPETITORS.some(c => c.toLowerCase() === match![0].toLowerCase());
    runs.push(new TextRun({
      text: match[0],
      size: baseFontSize,
      font: 'Arial',
      bold: true,
      color: isCompetitor ? 'C0392B' : ACCENT_COLOR,
      ...(baseProps || {}),
    }));
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({
      text: text.slice(lastIndex),
      size: baseFontSize,
      font: 'Arial',
      ...(baseProps || {}),
    }));
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, size: baseFontSize, font: 'Arial', ...(baseProps || {}) }));
  }

  return runs;
}

function createMainSectionHeader(text: string): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: text.toUpperCase(),
          bold: true,
          size: 30,
          color: 'FFFFFF',
          font: 'Arial',
        }),
      ],
      spacing: { after: 200 },
      shading: { fill: ACCENT_COLOR, type: 'clear' as any },
      indent: { left: 120, right: 120 },
    }),
  ];
}

function createSubSectionHeader(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: ACCENT_COLOR,
        font: 'Arial',
      }),
    ],
    spacing: { before: 400, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 2, color: DIVIDER_COLOR },
    },
  });
}

function createPublicationBlock(pub: Publication): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Type + Organ header
  const headerParts: string[] = [pub.publication_type];
  if (pub.organ) headerParts.push(pub.organ);

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: headerParts.join(' — '),
          bold: true,
          size: 21,
          color: ACCENT_COLOR,
          font: 'Arial',
        }),
      ],
      spacing: { before: 280, after: 80 },
      shading: { fill: LIGHT_ACCENT, type: 'clear' as any },
      indent: { left: 80, right: 80 },
    })
  );

  // Competitor badge
  if (pub.competitor_match) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `⚠ Concorrente: ${pub.competitor_match}`,
            bold: true,
            size: 20,
            color: 'C0392B',
            font: 'Arial',
          }),
        ],
        spacing: { after: 80 },
        indent: { left: 80 },
      })
    );
  }

  // Object
  if (pub.object_text) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Objeto: ',
            bold: true,
            size: 20,
            color: MUTED_COLOR,
            font: 'Arial',
          }),
          ...highlightTextRuns(pub.object_text, 20),
        ],
        spacing: { after: 100 },
        indent: { left: 80 },
      })
    );
  }

  // Full text with keyword highlighting
  paragraphs.push(
    new Paragraph({
      children: highlightTextRuns(pub.full_text, 19),
      spacing: { after: 200 },
      indent: { left: 80, right: 80 },
    })
  );

  // Light divider
  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: '', size: 8 })],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      },
      spacing: { after: 160 },
    })
  );

  return paragraphs;
}

function createEmptyMessage(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        italics: true,
        size: 20,
        color: '999999',
        font: 'Arial',
      }),
    ],
    spacing: { before: 120, after: 200 },
    indent: { left: 80 },
  });
}

const stateLabels: Record<string, string> = {
  SP: 'São Paulo',
  MG: 'Minas Gerais',
  DF: 'Distrito Federal',
};

export async function generateReport(
  readingDate: string,
  publications: Publication[]
): Promise<void> {
  const formattedDate = new Date(readingDate).toLocaleDateString('pt-BR');

  const children: Paragraph[] = [
    // Title block
    new Paragraph({ spacing: { before: 200 }, children: [] }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'RELATÓRIO DE LICITAÇÕES',
          bold: true,
          size: 40,
          color: ACCENT_COLOR,
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'DIÁRIO OFICIAL DA UNIÃO — SEÇÃO 3',
          bold: true,
          size: 24,
          color: MUTED_COLOR,
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Data da leitura: ${formattedDate}`,
          size: 22,
          font: 'Arial',
        }),
        new TextRun({
          text: `     |     Total: ${publications.length} publicações`,
          size: 22,
          font: 'Arial',
          color: MUTED_COLOR,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '', size: 8 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: ACCENT_COLOR } },
      spacing: { after: 300 },
    }),
    // Table of Contents for navigation
    new Paragraph({ spacing: { before: 200 }, children: [
      new TextRun({ text: 'SUMÁRIO', bold: true, size: 26, color: ACCENT_COLOR, font: 'Arial' }),
    ]}),
    new TableOfContents("Sumário", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ spacing: { after: 300 }, children: [] }),
  ];

  // ── SECTION 1: LICITAÇÕES (por região) ──
  const priorityPubs = publications.filter(p => ['SP', 'MG', 'DF'].includes(p.section));
  children.push(...createMainSectionHeader('Licitações por Região'));

  for (const state of ['SP', 'MG', 'DF']) {
    const statePubs = priorityPubs.filter(p => p.section === state);
    children.push(createSubSectionHeader(`${stateLabels[state]} (${state}) — ${statePubs.length} publicações`));

    if (statePubs.length === 0) {
      children.push(createEmptyMessage(`Nenhuma publicação identificada em ${stateLabels[state]}.`));
    } else {
      for (const pub of statePubs) {
        children.push(...createPublicationBlock(pub));
      }
    }
  }

  // ── SECTION 2: CONCORRÊNCIA ──
  const competitorPubs = publications.filter(p => p.section === 'CONCORRENTES');
  children.push(...createMainSectionHeader('Concorrência / Orion'));
  
  if (competitorPubs.length === 0) {
    children.push(createEmptyMessage('Nenhuma menção a concorrentes ou à Orion identificada.'));
  } else {
    for (const pub of competitorPubs) {
      children.push(...createPublicationBlock(pub));
    }
  }

  // ── SECTION 3: DIVERSOS ──
  const diversePubs = publications.filter(p => p.section === 'AVISOS_DIVERSOS');
  children.push(...createMainSectionHeader('Avisos Diversos'));

  if (diversePubs.length === 0) {
    children.push(createEmptyMessage('Nenhum aviso de outros estados identificado.'));
  } else {
    for (const pub of diversePubs) {
      children.push(...createPublicationBlock(pub));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20 },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 30, bold: true, font: 'Arial', color: 'FFFFFF' },
          paragraph: { spacing: { before: 600, after: 200 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: ACCENT_COLOR },
          paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Relatorio_DOU_${readingDate}.docx`);
}
