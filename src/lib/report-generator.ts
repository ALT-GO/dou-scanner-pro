import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

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

function createSectionHeader(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        color: '1B3A5C',
        font: 'Arial',
      }),
    ],
    spacing: { before: 400, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 2, color: '1B3A5C' },
    },
  });
}

function createPublicationBlock(pub: Publication): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${pub.publication_type}${pub.organ ? ` — ${pub.organ}` : ''}`,
          bold: true,
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { before: 200, after: 80 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: pub.full_text,
          size: 20,
          font: 'Arial',
        }),
      ],
      spacing: { after: 160 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: '', size: 10 })],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      spacing: { after: 120 },
    })
  );

  return paragraphs;
}

export async function generateReport(
  readingDate: string,
  publications: Publication[]
): Promise<void> {
  const spPubs = publications.filter(p => p.section === 'SP');
  const mgPubs = publications.filter(p => p.section === 'MG');
  const dfPubs = publications.filter(p => p.section === 'DF');
  const competitorPubs = publications.filter(p => p.section === 'CONCORRENTES');
  const diversosPubs = publications.filter(p => p.section === 'AVISOS_DIVERSOS');

  const formattedDate = new Date(readingDate).toLocaleDateString('pt-BR');

  const children: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: 'RELATÓRIO DE LICITAÇÕES',
          bold: true,
          size: 36,
          color: '1B3A5C',
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'DIÁRIO OFICIAL DA UNIÃO – SEÇÃO 3',
          bold: true,
          size: 26,
          color: '555555',
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Data da leitura: ${formattedDate}`,
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 400 },
    }),
  ];

  const sections = [
    { title: 'SP', pubs: spPubs },
    { title: 'MG', pubs: mgPubs },
    { title: 'DF', pubs: dfPubs },
    { title: 'CONCORRENTES / ORION', pubs: competitorPubs },
    { title: 'AVISOS DIVERSOS', pubs: diversosPubs },
  ];

  for (const section of sections) {
    children.push(createSectionHeader(section.title));
    if (section.pubs.length === 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Nenhuma publicação identificada nesta seção.',
              italics: true,
              size: 20,
              color: '888888',
              font: 'Arial',
            }),
          ],
          spacing: { after: 200 },
        })
      );
    } else {
      for (const pub of section.pubs) {
        children.push(...createPublicationBlock(pub));
      }
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Relatorio_DOU_${readingDate}.docx`);
}
