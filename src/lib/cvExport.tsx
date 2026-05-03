"use client";

import {
  Document as PdfDocument,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import {
  joinPresent,
  linkText,
  orderedSections,
  type CvSectionId,
  type StructuredCv,
} from "~/lib/cvDocument";
import {
  normalizeCvPresentation,
  presentationToRendererTokens,
  type RendererTokens,
} from "~/lib/cvPresentation";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function cvFileName(cv: StructuredCv, extension: "pdf" | "docx") {
  const base = [
    cv.header.name ?? "Taylor CV",
    cv.header.targetTitle ?? "Tailored CV",
  ]
    .join(" ")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "Taylor-CV"}.${extension}`;
}

const styles = StyleSheet.create({
  page: {
    padding: 42,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: "#18181b",
    lineHeight: 1.35,
  },
  header: {
    textAlign: "center",
    marginBottom: 18,
  },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  meta: {
    fontSize: 9.5,
    color: "#3f3f46",
  },
  section: {
    marginBottom: 12,
  },
  heading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d8",
    paddingBottom: 3,
    marginBottom: 6,
  },
  itemTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
  },
  itemMeta: {
    fontSize: 9.5,
    color: "#52525b",
  },
  bulletRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 2,
  },
  bullet: {
    width: 8,
  },
  bulletText: {
    flex: 1,
  },
  paragraph: {
    marginBottom: 2,
  },
});

function BulletList(props: { bullets: string[]; tokens: RendererTokens }) {
  return (
    <View>
      {props.bullets.map((bullet, index) => (
        <View
          style={[
            styles.bulletRow,
            { marginBottom: props.tokens.bulletGap },
          ]}
          key={`${bullet}-${index}`}
        >
          <Text style={[styles.bullet, { color: props.tokens.bodyTextColor }]}>-</Text>
          <Text
            style={[styles.bulletText, { color: props.tokens.bodyTextColor }]}
          >
            {bullet}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PdfSection(props: {
  title: string;
  children: React.ReactNode;
  tokens: RendererTokens;
}) {
  return (
    <View style={[styles.section, { marginBottom: props.tokens.sectionGap }]}>
      <Text
        style={[
          styles.heading,
          {
            color: props.tokens.accentColor,
            borderBottomWidth: props.tokens.dividerStyle === "no_rule" ? 0 : 1,
            borderBottomColor: props.tokens.dividerColor,
            fontSize: props.tokens.headingSize,
          },
        ]}
      >
        {props.title}
      </Text>
      {props.children}
    </View>
  );
}

function CvPdfDocument(props: { cv: StructuredCv; presentation?: unknown }) {
  const presentation = normalizeCvPresentation(props.presentation, props.cv);
  const tokens = presentationToRendererTokens(presentation);
  const meta = [
    props.cv.header.targetTitle,
    props.cv.header.location,
    props.cv.header.phone,
    props.cv.header.email,
    ...props.cv.header.links.map(linkText),
  ].filter(Boolean);
  const headerAlign = props.cv.header.name ? tokens.headerAlign : "left";

  function renderSection(section: CvSectionId) {
    if (section === "summary") {
      return (
        <PdfSection title={tokens.labelFor("summary")} key="summary" tokens={tokens}>
          <Text
            style={[
              styles.paragraph,
              {
                color: tokens.bodyTextColor,
                fontSize: tokens.bodySize,
                lineHeight: tokens.lineHeight,
              },
            ]}
          >
            {props.cv.summary}
          </Text>
        </PdfSection>
      );
    }

    if (section === "projects" && props.cv.projects.length > 0) {
      return (
        <PdfSection title={tokens.labelFor("projects")} key="projects" tokens={tokens}>
          {props.cv.projects.map((project, index) => {
            const title = joinPresent([project.name, project.descriptor], " - ");
            return (
              <View key={`${title}-${index}`} style={{ marginBottom: tokens.itemGap }}>
                {title || project.dates ? (
                  <View style={styles.itemTitleRow}>
                    <Text style={[styles.itemTitle, { color: tokens.bodyTextColor }]}>
                      {title}
                    </Text>
                    <Text style={[styles.itemMeta, { color: tokens.mutedTextColor }]}>
                      {project.dates ?? ""}
                    </Text>
                  </View>
                ) : null}
                <BulletList bullets={project.bullets} tokens={tokens} />
              </View>
            );
          })}
        </PdfSection>
      );
    }

    if (section === "experience" && props.cv.experience.length > 0) {
      return (
        <PdfSection title={tokens.labelFor("experience")} key="experience" tokens={tokens}>
          {props.cv.experience.map((item, index) => {
            const title = joinPresent([item.title, item.company], " - ");
            const meta = joinPresent([item.dates, item.location], " | ");
            return (
              <View key={`${title}-${index}`} style={{ marginBottom: tokens.itemGap }}>
                {title || meta ? (
                  <View style={styles.itemTitleRow}>
                    <Text style={[styles.itemTitle, { color: tokens.bodyTextColor }]}>
                      {title}
                    </Text>
                    <Text style={[styles.itemMeta, { color: tokens.mutedTextColor }]}>
                      {meta}
                    </Text>
                  </View>
                ) : null}
                <BulletList bullets={item.bullets} tokens={tokens} />
              </View>
            );
          })}
        </PdfSection>
      );
    }

    if (section === "skills" && props.cv.skills.groups.length > 0) {
      return (
        <PdfSection title={tokens.labelFor("skills")} key="skills" tokens={tokens}>
          {props.cv.skills.groups.map((group) => (
            <Text
              style={[
                styles.paragraph,
                {
                  color: tokens.bodyTextColor,
                  fontSize: tokens.bodySize,
                  marginBottom: tokens.bulletGap,
                },
              ]}
              key={group.label}
            >
              <Text style={{ fontFamily: "Helvetica-Bold", color: tokens.accentColor }}>
                {group.label}:{" "}
              </Text>
              {group.items.join(", ")}
            </Text>
          ))}
        </PdfSection>
      );
    }

    if (section === "education" && props.cv.education.length > 0) {
      return (
        <PdfSection title={tokens.labelFor("education")} key="education" tokens={tokens}>
          {props.cv.education.map((item, index) => {
            const title = joinPresent([item.degree, item.institution], " - ");
            return (
              <View key={`${title}-${index}`} style={{ marginBottom: tokens.itemGap }}>
                <View style={styles.itemTitleRow}>
                  <Text style={[styles.itemTitle, { color: tokens.bodyTextColor }]}>
                    {title}
                  </Text>
                  <Text style={[styles.itemMeta, { color: tokens.mutedTextColor }]}>
                    {item.dates ?? ""}
                  </Text>
                </View>
                {item.details.length > 0 ? (
                  <Text style={{ color: tokens.bodyTextColor }}>
                    {item.details.join("; ")}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </PdfSection>
      );
    }

    if (section === "certifications" && props.cv.certifications.length > 0) {
      return (
        <PdfSection
          title={tokens.labelFor("certifications")}
          key="certifications"
          tokens={tokens}
        >
          <Text style={{ color: tokens.bodyTextColor }}>
            {props.cv.certifications.join("; ")}
          </Text>
        </PdfSection>
      );
    }

    return null;
  }

  return (
    <PdfDocument>
      <Page
        size="A4"
        style={[
          styles.page,
          {
            padding: tokens.pagePadding,
            fontSize: tokens.bodySize,
            fontFamily: tokens.pdfFontFamily,
            color: tokens.bodyTextColor,
            lineHeight: tokens.lineHeight,
          },
        ]}
      >
        <View
          style={[
            styles.header,
            {
              textAlign: headerAlign,
              marginBottom: tokens.sectionGap + 2,
            },
          ]}
        >
          {props.cv.header.name ? (
            <Text
              style={[
                styles.name,
                {
                  color: tokens.bodyTextColor,
                  fontSize: tokens.nameSize,
                  fontFamily: tokens.pdfFontFamily,
                },
              ]}
            >
              {props.cv.header.name}
            </Text>
          ) : null}
          {meta.length > 0 ? (
            <Text
              style={[
                styles.meta,
                {
                  color: tokens.mutedTextColor,
                  fontSize: tokens.subtitleSize,
                },
              ]}
            >
              {meta.join(" | ")}
            </Text>
          ) : null}
        </View>
        {orderedSections(props.cv.sectionOrder).map(renderSection)}
      </Page>
    </PdfDocument>
  );
}

function docxColor(hex: string) {
  return hex.replace("#", "").toUpperCase();
}

function heading(text: string, tokens: RendererTokens) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: tokens.headingWeight >= 600,
        color: docxColor(tokens.accentColor),
        font: tokens.docxFontFamily,
        size: Math.round(tokens.headingSize * 2),
      }),
    ],
    border:
      tokens.dividerStyle === "no_rule"
        ? undefined
        : {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 4,
              color: docxColor(tokens.dividerColor),
            },
          },
    spacing: {
      before: Math.round(tokens.sectionGap * 12),
      after: Math.round(tokens.itemGap * 10),
    },
  });
}

function bullet(text: string, tokens: RendererTokens) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        color: docxColor(tokens.bodyTextColor),
        font: tokens.docxFontFamily,
        size: Math.round(tokens.bodySize * 2),
      }),
    ],
    bullet: { level: 0 },
    spacing: { after: Math.round(tokens.bulletGap * 14) },
  });
}

export async function exportCvPdf(cv: StructuredCv, presentation?: unknown) {
  const blob = await pdf(
    <CvPdfDocument cv={cv} presentation={presentation} />
  ).toBlob();
  downloadBlob(blob, cvFileName(cv, "pdf"));
}

export async function exportCvDocx(cv: StructuredCv, presentation?: unknown) {
  const normalizedPresentation = normalizeCvPresentation(presentation, cv);
  const tokens = presentationToRendererTokens(normalizedPresentation);
  const children: Paragraph[] = [];
  const headerAlignment =
    cv.header.name && tokens.headerAlign === "center"
      ? AlignmentType.CENTER
      : AlignmentType.LEFT;
  const meta = [
    cv.header.targetTitle,
    cv.header.location,
    cv.header.phone,
    cv.header.email,
    ...cv.header.links.map(linkText),
  ].filter(Boolean);

  if (cv.header.name) {
    children.push(
      new Paragraph({
        alignment: headerAlignment,
        children: [
          new TextRun({
            text: cv.header.name,
            bold: true,
            size: Math.round(tokens.nameSize * 2),
            color: docxColor(tokens.bodyTextColor),
            font: tokens.docxFontFamily,
          }),
        ],
      })
    );
  }
  if (meta.length > 0) {
    children.push(
      new Paragraph({
        alignment: headerAlignment,
        children: [
          new TextRun({
            text: meta.join(" | "),
            size: Math.round(tokens.subtitleSize * 2),
            color: docxColor(tokens.mutedTextColor),
            font: tokens.docxFontFamily,
          }),
        ],
        spacing: { after: 180 },
      })
    );
  }

  for (const section of orderedSections(cv.sectionOrder)) {
    if (section === "summary") {
      children.push(
        heading(tokens.labelFor("summary").toUpperCase(), tokens),
        new Paragraph({
          children: [
            new TextRun({
              text: cv.summary,
              color: docxColor(tokens.bodyTextColor),
              font: tokens.docxFontFamily,
              size: Math.round(tokens.bodySize * 2),
            }),
          ],
        })
      );
    }

    if (section === "projects" && cv.projects.length > 0) {
      children.push(heading(tokens.labelFor("projects").toUpperCase(), tokens));
      for (const project of cv.projects) {
        const title = joinPresent([project.name, project.descriptor], " - ");
        if (title || project.dates) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: title,
                  bold: true,
                  color: docxColor(tokens.bodyTextColor),
                  font: tokens.docxFontFamily,
                }),
                new TextRun({
                  text: project.dates ? ` | ${project.dates}` : "",
                  color: docxColor(tokens.mutedTextColor),
                  font: tokens.docxFontFamily,
                }),
              ],
            })
          );
        }
        children.push(...project.bullets.map((item) => bullet(item, tokens)));
      }
    }

    if (section === "experience" && cv.experience.length > 0) {
      children.push(heading(tokens.labelFor("experience").toUpperCase(), tokens));
      for (const item of cv.experience) {
        const title = joinPresent([item.title, item.company], " - ");
        const metaText = joinPresent([item.dates, item.location], " | ");
        if (title || metaText) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: title,
                  bold: true,
                  color: docxColor(tokens.bodyTextColor),
                  font: tokens.docxFontFamily,
                }),
                new TextRun({
                  text: metaText ? ` | ${metaText}` : "",
                  color: docxColor(tokens.mutedTextColor),
                  font: tokens.docxFontFamily,
                }),
              ],
            })
          );
        }
        children.push(...item.bullets.map((text) => bullet(text, tokens)));
      }
    }

    if (section === "skills" && cv.skills.groups.length > 0) {
      children.push(heading(tokens.labelFor("skills").toUpperCase(), tokens));
      for (const group of cv.skills.groups) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${group.label}: `,
                bold: true,
                color: docxColor(tokens.accentColor),
                font: tokens.docxFontFamily,
              }),
              new TextRun({
                text: group.items.join(", "),
                color: docxColor(tokens.bodyTextColor),
                font: tokens.docxFontFamily,
              }),
            ],
          })
        );
      }
    }

    if (section === "education" && cv.education.length > 0) {
      children.push(heading(tokens.labelFor("education").toUpperCase(), tokens));
      for (const item of cv.education) {
        const title = joinPresent([item.degree, item.institution], " - ");
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: title,
                bold: true,
                color: docxColor(tokens.bodyTextColor),
                font: tokens.docxFontFamily,
              }),
              new TextRun({
                text: item.dates ? ` | ${item.dates}` : "",
                color: docxColor(tokens.mutedTextColor),
                font: tokens.docxFontFamily,
              }),
            ],
          })
        );
        if (item.details.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: item.details.join("; "),
                  color: docxColor(tokens.bodyTextColor),
                  font: tokens.docxFontFamily,
                }),
              ],
            })
          );
        }
      }
    }

    if (section === "certifications" && cv.certifications.length > 0) {
      children.push(
        heading(tokens.labelFor("certifications").toUpperCase(), tokens)
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cv.certifications.join("; "),
              color: docxColor(tokens.bodyTextColor),
              font: tokens.docxFontFamily,
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, cvFileName(cv, "docx"));
}
