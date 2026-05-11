import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BatchEvidenceFitOutputSchema,
  CvBuilderOutputSchema,
  CvStrategyOutputSchema,
  CvWriterOutputSchema,
  GapQuestionOutputSchema,
  JobParserOutputSchema,
} from "../src/lib/schemas.ts";
import { normalizeCvBuilderRawOutput } from "../src/lib/cvBuilderCanonicalizer.ts";
import { normalizeCvPresentation } from "../src/lib/cvPresentation.ts";
import { normalizeCvSections, parseStructuredCv } from "../src/lib/cvDocument.ts";
import {
  friendlyGenerationErrorMessage,
  isStableApplicationStatus,
  shouldRepairWorkflowForDraft,
  workflowStateForGenerationStep,
} from "../src/lib/workflowStatus.ts";
import {
  calculateDeterministicAfterScore,
  runDeterministicCvQa,
} from "../src/server/services/cvQa.service.ts";
import { AgentRunStatus, ApplicationStatus } from "../generated/prisma/index.js";

const bannedPhrases =
  /\b(basic|limited|learning exercise|interested in growing|still developing|helped with|did not own|early hands-on|assisted with|participated in|exposure)\b/i;

const benStrategy = {
  strategySummary:
    "Position Ben as an early-career applied AI/backend engineer and cut weak notebook-style projects.",
  targetPositioning:
    "Early-career applied AI/backend engineer with credible hands-on LLM, RAG chatbot, and TypeScript backend evidence.",
  roleFamily: "software_ai_data",
  topRoleSignals: ["LLM applications", "RAG", "Backend foundations"],
  candidateProofForTopSignals: [
    {
      signal: "RAG",
      proof: "Built document-grounded chatbot workflows with retrieval and response debugging.",
      requirementId: "req-rag",
      chunkIds: ["chunk-rag"],
    },
  ],
  proofStyle: "technical_depth",
  summaryDirection:
    "Lead with applied AI/backend fit, RAG chatbot evidence, and practical response-quality debugging.",
  layoutArchitecture: "premium_hybrid",
  topTenSecondProof: [
    "LLM/RAG chatbot evidence",
    "Source-grounded response safeguards",
    "Python/TypeScript backend foundations",
  ],
  sectionOrder: ["summary", "projects", "experience", "skills", "education"],
  sectionBudgets: {
    summary: "compressed",
    projects: "full",
    experience: "compressed",
    skills: "compressed",
    education: "one_line",
    certifications: "omit",
  },
  leadWith: ["LLM/RAG chatbot", "Backend workflow"],
  mustUseEvidence: [
    {
      requirementId: "req-rag",
      chunkIds: ["chunk-rag"],
      note: "Use the chatbot/RAG project as flagship proof.",
    },
  ],
  compressOrCut: ["Cut Sales Forecast Notebook unless directly relevant."],
  claimBoundaries: [
    "Do not claim Anthropic-level production experience, formal eval pipelines, fine-tuning, high-scale systems, or safety research.",
  ],
  missingMetricsToAsk: ["Ask for document count or user/tester scope if truthful."],
  skillsPlan: {
    keepGroups: ["Languages", "AI / LLM", "Backend / Data", "Frontend"],
    cutSkills: ["Unsupported AI research terms"],
    presentation: "Compact grouped rows.",
  },
  certificationPlan: {
    treatment: "omit",
    rationale: "No role-critical certification evidence.",
  },
  writerStyleRules: ["No em dashes", "No self-limiting language", "Use truthful scope"],
  emphasis: ["RAG chatbot", "Backend foundations"],
  deEmphasis: ["Sales Forecast Notebook"],
  evidenceToUse: [
    {
      requirementId: "req-rag",
      chunkIds: ["chunk-rag"],
      note: "Use as flagship project evidence.",
    },
  ],
  warnings: ["Do not overstate production scale."],
};

const benCv = {
  cvJson: {
    sectionOrder: ["summary", "projects", "experience", "skills", "education"],
    header: {
      name: "Ben Smith",
      targetTitle: "Applied AI / Backend Engineer",
      location: "Auckland",
      phone: null,
      email: "ben@example.com",
      links: [],
    },
    summary:
      "Early-career applied AI/backend engineer with hands-on LLM, RAG chatbot, and TypeScript product evidence. Strongest in document-grounded AI workflows, response-quality debugging, and backend foundations.",
    skills: {
      groups: [
        { group: "Languages", skills: ["Python", "TypeScript", "JavaScript"] },
        { group: "AI / LLM", skills: ["RAG", "embeddings", "structured outputs"] },
        { group: "Backend / Data", skills: ["Node.js", "PostgreSQL", "pgvector", "Prisma"] },
        { group: "Frontend", skills: ["Next.js", "React"] },
      ],
    },
    projects: [
      {
        name: "RAG Support Chatbot",
        descriptor: null,
        dates: null,
        bullets: [
          {
            text: "Built a document-grounded chatbot with retrieval, source context, response debugging, and backend integration.",
            sourceChunkIds: ["chunk-rag"],
            gapAnswerIds: [],
          },
          {
            text: "Used Python and TypeScript foundations to connect model responses with application workflows.",
            sourceChunkIds: ["chunk-rag"],
            gapAnswerIds: [],
          },
        ],
      },
      {
        name: "Document Q&A Assistant",
        descriptor: null,
        dates: null,
        bullets: [
          {
            text: "Built a retrieval-backed question answering workflow that connected source documents with concise answers.",
            sourceChunkIds: ["chunk-rag"],
            gapAnswerIds: [],
          },
        ],
      },
    ],
    experience: [
      {
        role: "AI Application Builder",
        company: null,
        dates: "2024 - 2025",
        location: "Auckland",
        bullets: [
          {
            text: "Delivered working MVP flows connecting model outputs, database writes, and user-facing interfaces.",
            sourceChunkIds: ["chunk-rag"],
            gapAnswerIds: [],
          },
        ],
      },
    ],
    education: [
      {
        institution: null,
        degree: "Relevant AI/backend project work",
        dates: null,
        details: [],
      },
    ],
    certifications: [],
  },
  cvText: "Ben Smith\nApplied AI / Backend Engineer\n\nSUMMARY\nEarly-career applied AI/backend engineer with hands-on LLM, RAG chatbot, and TypeScript product evidence.",
  assumptions: [],
  improvementSuggestions: ["Add truthful document count or user/tester scope."],
};

assert.equal(CvStrategyOutputSchema.safeParse(benStrategy).success, true);
assert.equal(CvWriterOutputSchema.safeParse(benCv).success, true);
assert.equal(benStrategy.layoutArchitecture, "premium_hybrid");
assert.equal(benCv.cvJson.summary.split(/\s+/).length <= 75, true);
assert.equal(bannedPhrases.test(JSON.stringify(benCv)), false);
assert.equal(JSON.stringify(benCv).includes("—"), false);
assert.equal(
  benCv.cvJson.projects.reduce((count, project) => count + project.bullets.length, 0) +
    benCv.cvJson.experience.reduce((count, item) => count + item.bullets.length, 0) <=
    12,
  true
);
assert.equal(
  benCv.cvJson.skills.groups.reduce((count, group) => count + group.skills.length, 0) <=
    24,
  true
);
assert.equal(/Anthropic|fine-tun|high-scale|safety research|formal evaluation pipeline/i.test(JSON.stringify(benCv)), false);

const retailCv = {
  ...benCv.cvJson,
  sectionOrder: ["summary", "experience", "skills", "education"],
  header: { ...benCv.cvJson.header, targetTitle: "Retail Assistant" },
  summary:
    "Reliable retail assistant with customer service, busy shift, stock handling, and practical communication strengths.",
  skills: {
    groups: [
      { group: "Service", skills: ["Customer service", "POS", "Complaint handling"] },
      { group: "Store Duties", skills: ["Stock handling", "Busy shifts", "Cleaning standards"] },
    ],
  },
  projects: [],
};

const retailPresentation = normalizeCvPresentation(null, retailCv);
assert.notEqual(retailPresentation.layoutArchitecture, "premium_hybrid");
assert.equal(retailPresentation.layoutArchitecture, "simple_practical");

const benGapQuestions = {
  coachInsight: {
    openingMessage:
      "A few short answers can make Ben's AI/backend evidence sharper.",
    jobWants:
      "The role wants applied LLM systems, response quality, and practical delivery.",
    candidateStrengths: ["Ben already has RAG chatbot and backend evidence."],
    candidateConcerns: [
      "Usage, evaluation, and feedback scope need one-line clarification.",
    ],
  },
  questions: [
    {
      targetRequirementId: "req-rag",
      question: "Did anyone use the chatbot or was it mainly a prototype?",
      reason: "Usage scope is not clear yet.",
      whyItMatters:
        "This role values AI systems that support real users, not just chatbot demos.",
      answerGuidance: "One line: who used it and what did it help them do?",
      exampleAngles: [
        "Examples: classmates, internal users, small test group, prototype only.",
      ],
      shortQuestion: "Did anyone use the chatbot or was it mainly a prototype?",
      whyThisMatters:
        "This role values AI systems that support real users, not just chatbot demos.",
      linkedJobRequirement: "Build document-grounded AI applications",
      howYourAnswerHelps:
        "A short usage detail lets Taylor show truthful product scope without overstating production scale.",
      quickOptions: ["Yes, people used it", "Small test group", "Prototype only", "Skip"],
      selectedOptionRequiresDetail: true,
      followUpPrompt: "One line: who used it and what did it help them do?",
      metricPrompt: null,
      metricOptionTriggers: [],
      questionType: "outcome_or_impact",
      exampleAnswer:
        "Examples: classmates, internal users, small test group, prototype only.",
      priorityReason: "High-impact usage scope gap.",
    },
    {
      targetRequirementId: "req-eval",
      question:
        "This role values LLM evaluation. Have you tested or scored AI outputs before?",
      reason: "Evaluation evidence is unclear.",
      whyItMatters:
        "This role asks for reliable AI systems, not just chatbot demos.",
      answerGuidance:
        "One line: what did you test, how did you check it, and any rough number if you know it?",
      exampleAngles: [
        "Examples: rubric, prompt comparison, model-as-judge, accuracy checks.",
      ],
      shortQuestion:
        "This role values LLM evaluation. Have you tested or scored AI outputs before?",
      whyThisMatters:
        "This role asks for reliable AI systems, not just chatbot demos.",
      linkedJobRequirement:
        "Create evaluation workflows to measure model quality, reliability, and safety.",
      howYourAnswerHelps:
        "A short example lets Taylor turn this into evidence of testing and response-quality improvement.",
      quickOptions: ["Yes, I did", "Kind of", "Not formally", "Skip"],
      selectedOptionRequiresDetail: true,
      followUpPrompt:
        "One line: what did you test, how did you check it, and any rough number if you know it?",
      metricPrompt: null,
      metricOptionTriggers: [],
      questionType: "safety_or_quality",
      exampleAnswer:
        "Examples: rubric, prompt comparison, model-as-judge, accuracy checks.",
      priorityReason: "High-impact LLM quality evidence gap.",
    },
    {
      targetRequirementId: "req-feedback",
      question: "Did anyone help test, use, or give feedback on the chatbot?",
      reason: "Feedback context is unclear.",
      whyItMatters:
        "Feedback shows whether the chatbot was checked against real expectations.",
      answerGuidance:
        "One line: who was involved and what role or feedback did they provide?",
      exampleAngles: [
        "Examples: classmates, teacher or mentor feedback, solo testing notes.",
      ],
      shortQuestion: "Did anyone help test, use, or give feedback on the chatbot?",
      whyThisMatters:
        "Feedback shows whether the chatbot was checked against real expectations.",
      linkedJobRequirement: "Collaborate and improve AI application quality.",
      howYourAnswerHelps:
        "A concise feedback detail can prove communication and practical improvement without inventing team ownership.",
      quickOptions: ["Yes, a team/classmates", "One person gave feedback", "Worked solo", "Skip"],
      selectedOptionRequiresDetail: true,
      followUpPrompt:
        "One line: who was involved and what role or feedback did they provide?",
      metricPrompt: null,
      metricOptionTriggers: [],
      questionType: "collaboration",
      exampleAnswer:
        "Examples: classmates, teacher or mentor feedback, solo testing notes.",
      priorityReason: "High-impact collaboration evidence gap.",
    },
  ],
};

assert.equal(GapQuestionOutputSchema.safeParse(benGapQuestions).success, true);
for (const question of benGapQuestions.questions) {
  assert.equal(question.quickOptions.length <= 4, true);
  assert.equal(question.quickOptions[question.quickOptions.length - 1], "Skip");
  assert.equal(
    /Product team|Support team|Infrastructure team|Senior developers/i.test(
      question.quickOptions.join(" ")
    ),
    false
  );
  assert.equal(/^One line:/.test(question.followUpPrompt), true);
}
assert.equal(
  benGapQuestions.questions[1].quickOptions.includes("Built an evaluation rubric"),
  false
);
assert.equal(ApplicationStatus.strategy_failed, "strategy_failed");
assert.equal(ApplicationStatus.draft_failed, "draft_failed");
assert.equal(ApplicationStatus.draft_ready, "draft_ready");
assert.equal(AgentRunStatus.failed, "failed");
for (const step of ["strategy_failed", "draft_failed", "draft_ready"]) {
  const state = workflowStateForGenerationStep(step);
  assert.equal(isStableApplicationStatus(state.status), true);
  assert.notEqual(state.status, step);
  assert.equal(state.currentStep, step);
}
assert.deepEqual(workflowStateForGenerationStep("strategy_failed"), {
  status: "answers_added",
  currentStep: "strategy_failed",
});
assert.deepEqual(workflowStateForGenerationStep("draft_failed"), {
  status: "strategy_ready",
  currentStep: "draft_failed",
});
assert.deepEqual(workflowStateForGenerationStep("draft_ready"), {
  status: "cv_ready",
  currentStep: "draft_ready",
});
assert.equal(
  shouldRepairWorkflowForDraft({
    hasDraft: true,
    status: "strategy_ready",
    currentStep: "strategy_ready",
  }),
  true
);
assert.equal(
  shouldRepairWorkflowForDraft({
    hasDraft: true,
    status: "cv_ready",
    currentStep: "draft_ready",
  }),
  false
);
assert.equal(
  friendlyGenerationErrorMessage(
    "Invalid `prisma.application.update()` invocation: Expected ApplicationStatus.",
    "Taylor created the CV strategy, but had trouble writing the final CV. Try again."
  ),
  "Taylor created the CV strategy, but had trouble writing the final CV. Try again."
);
assert.equal(
  friendlyGenerationErrorMessage(
    '[{"code":"invalid_type","expected":"string","received":"undefined","path":["cvJson","sections",3,"items",0,"name"],"message":"Required"}]',
    "Taylor created the CV strategy, but had trouble writing the final CV. Try again."
  ),
  "Taylor created the CV strategy, but had trouble writing the final CV. Try again."
);

const fastJob = {
  title: "AI Application Engineer",
  company: "Taylor Labs",
  seniority: "Mid-level",
  summary: "Build applied AI products.",
  roleDomain: "software_ai_data",
  archetypeHint: "applied_ai_engineering",
  requirements: Array.from({ length: 14 }, (_, index) => ({
    type: "skill",
    label: `Requirement ${index + 1}`,
    description: `Requirement ${index + 1} description`,
    importance: index < 8 ? "high" : "medium",
  })),
};
assert.equal(JobParserOutputSchema.safeParse(fastJob).success, true);
assert.equal(fastJob.requirements.length <= 14, true);
assert.equal(
  fastJob.requirements.filter((requirement) => requirement.importance === "high").length <= 8,
  true
);

const batchFit = {
  currentMatchScore: 62,
  matchLabel: "Promising but untailored",
  topStrengths: ["RAG project evidence"],
  weakSpots: ["Production scale"],
  evidenceCards: [
    {
      requirementId: "req-rag",
      requirementLabel: "RAG",
      candidateChunkId: "chunk-rag",
      content: "Built a document-grounded chatbot.",
      confidence: "high",
      reason: "Directly supports the role requirement.",
      claimRisk: "safe",
    },
  ],
  requirementFitSummary: [
    {
      requirementId: "req-rag",
      confidence: "high",
      bestCandidateChunkId: "chunk-rag",
      reason: "Direct match.",
      claimRisk: "safe",
      cvUsefulness: "headline",
    },
  ],
  claimRisks: ["Avoid overstating production scale."],
  recommendedGapQuestions: [
    {
      targetRequirementId: "req-rag",
      question: "Did anyone use the chatbot?",
      shortQuestion: "Did anyone use the chatbot?",
      linkedJobRequirement: "RAG",
      whyThisMatters: "Usage scope improves proof.",
      howYourAnswerHelps: "It lets Taylor write truthful scope.",
      quickOptions: ["Yes", "Small group", "Prototype", "Skip"],
      selectedOptionRequiresDetail: true,
      followUpPrompt: "Who used it?",
      dynamicGuidance: "Use a real example only.",
      questionType: "scope_enrichment",
    },
  ],
  cvAngle: "Lead with applied AI project evidence.",
  roleArchetype: "applied_ai_engineering",
};
assert.equal(BatchEvidenceFitOutputSchema.safeParse(batchFit).success, true);
assert.equal(batchFit.recommendedGapQuestions.length <= 4, true);

const cvBuilderOutput = {
  roleArchetype: "applied_ai_engineering",
  targetPositioning: "Applied AI engineer with RAG product evidence.",
  cvAngle: "Lead with AI engineering proof.",
  sectionPlan: ["Profile", "Selected AI Engineering Evidence", "Technical Skills"],
  evidenceAllocation: [
    {
      sectionId: "selected-ai-evidence",
      evidence: ["Built a document-grounded chatbot."],
      rationale: "Strongest role proof.",
    },
  ],
  claimBoundaries: ["Do not overstate production scale."],
  strongestEvidenceUsed: ["Built a document-grounded chatbot."],
  stillLimited: ["Production scale"],
  beforeScoreRecommendation: 62,
  afterScoreRecommendation: 92,
  cvJson: {
    ...benCv.cvJson,
    sections: [
      {
        id: "summary",
        label: "Profile",
        type: "summary",
        priority: "primary",
        items: [{ text: benCv.cvJson.summary, sourceChunkIds: [], gapAnswerIds: [] }],
      },
      {
        id: "selected-ai-evidence",
        label: "Selected AI Engineering Evidence",
        type: "bullets",
        priority: "primary",
        items: [
          {
            text: "Built a document-grounded chatbot.",
            sourceChunkIds: ["chunk-rag"],
            gapAnswerIds: [],
          },
        ],
      },
      {
        id: "projects",
        label: "Selected Projects",
        type: "projects",
        priority: "primary",
        items: benCv.cvJson.projects,
      },
      {
        id: "experience",
        label: "Experience",
        type: "experience",
        priority: "secondary",
        items: benCv.cvJson.experience,
      },
      {
        id: "skills",
        label: "Technical Skills",
        type: "skills",
        priority: "secondary",
        items: benCv.cvJson.skills.groups,
      },
      {
        id: "education",
        label: "Education",
        type: "education",
        priority: "supporting",
        items: benCv.cvJson.education,
      },
    ],
  },
  cvText: benCv.cvText,
  assumptions: [],
};
assert.equal(CvBuilderOutputSchema.safeParse(cvBuilderOutput).success, true);
assert.equal(cvBuilderOutput.cvJson.sections.length > 0, true);
assert.equal(cvBuilderOutput.afterScoreRecommendation >= 80, true);
assert.equal(cvBuilderOutput.afterScoreRecommendation < 99, true);

const benStructured = parseStructuredCv(cvBuilderOutput.cvJson);
assert.notEqual(benStructured, null);
const benSections = normalizeCvSections(benStructured);
const benRenderedText = JSON.stringify(cvBuilderOutput.cvJson);
const benSkills = benSections.find((section) => section.type === "skills");
const benExperience = benSections.find((section) => section.type === "experience");
const benProjects = benSections.find((section) => section.type === "projects");
const benEducation = benSections.find((section) => section.type === "education");
assert.equal(benSkills?.type, "skills");
assert.equal(benSkills.groups.reduce((count, group) => count + group.skills.length, 0) > 0, true);
assert.equal(benExperience?.type, "experience");
assert.equal(benProjects?.type, "projects");
assert.equal(benProjects.items.every((item) => item.name && item.bullets.length > 0), true);
assert.equal(benEducation?.type, "education");
assert.equal(benEducation.items.some((item) => item.degree || item.institution), true);
assert.equal(
  benExperience.items.every((item) => item.role && item.dates && item.location && item.bullets.length > 0),
  true
);
assert.equal(
  benExperience.items.some((item) => item.bullets.some((bullet) => bullet.text.includes("; "))),
  false
);
assert.equal(
  /\b(Strong fit|Taylor|the candidate|match score|CV Match Strength)\b/i.test(benRenderedText),
  false
);
assert.equal(/model calls|batching slower steps|timing logs/i.test(benRenderedText), false);
assert.equal(/border-blue-700|thick blue/i.test(benRenderedText), false);
assert.equal(
  benSections.every((section) => {
    if (section.type === "experience") {
      return section.items.every((item) =>
        item.bullets.every((bullet) => bullet.sourceChunkIds.length || bullet.gapAnswerIds.length)
      );
    }
    if (section.type === "projects") {
      return section.items.every((item) =>
        item.bullets.every((bullet) => bullet.sourceChunkIds.length || bullet.gapAnswerIds.length)
      );
    }
    if (section.type === "bullets") {
      return section.bullets.every((bullet) => bullet.sourceChunkIds.length || bullet.gapAnswerIds.length);
    }
    return true;
  }),
  true
);

const malformedProjectSectionOutput = {
  ...cvBuilderOutput,
  cvJson: {
    ...cvBuilderOutput.cvJson,
    sections: cvBuilderOutput.cvJson.sections.map((section) =>
      section.id === "projects"
        ? {
            ...section,
            items: [
              {
                text: "Built a document-grounded chatbot.",
                sourceChunkIds: ["chunk-rag"],
                gapAnswerIds: [],
              },
            ],
          }
        : section
    ),
  },
};
assert.equal(CvBuilderOutputSchema.safeParse(malformedProjectSectionOutput).success, false);
const repairedProjectSectionOutput = normalizeCvBuilderRawOutput(malformedProjectSectionOutput);
assert.equal(CvBuilderOutputSchema.safeParse(repairedProjectSectionOutput).success, true);
const repairedProjectSections = normalizeCvSections(
  parseStructuredCv(repairedProjectSectionOutput.cvJson)
);
const repairedProjectSection = repairedProjectSections.find((section) => section.type === "projects");
assert.equal(repairedProjectSection?.type, "projects");
assert.equal(repairedProjectSection.items.length, benCv.cvJson.projects.length);

const bulletOnlyProjectAndEducationOutput = {
  ...cvBuilderOutput,
  cvJson: {
    ...cvBuilderOutput.cvJson,
    projects: [],
    education: [],
    sections: cvBuilderOutput.cvJson.sections.map((section) => {
      if (section.id === "projects") {
        return {
          ...section,
          items: [
            {
              text: "Built a document-grounded chatbot.",
              sourceChunkIds: ["chunk-rag"],
              gapAnswerIds: [],
            },
          ],
        };
      }
      if (section.id === "education") {
        return {
          ...section,
          items: [
            {
              text: "Completed relevant AI/backend project work.",
              sourceChunkIds: [],
              gapAnswerIds: [],
            },
          ],
        };
      }
      return section;
    }),
  },
};
assert.equal(CvBuilderOutputSchema.safeParse(bulletOnlyProjectAndEducationOutput).success, false);
const repairedBulletOnlyOutput = normalizeCvBuilderRawOutput(bulletOnlyProjectAndEducationOutput);
assert.equal(CvBuilderOutputSchema.safeParse(repairedBulletOnlyOutput).success, true);
const repairedBulletOnlySections = normalizeCvSections(
  parseStructuredCv(repairedBulletOnlyOutput.cvJson)
);
assert.equal(
  repairedBulletOnlySections
    .filter((section) => section.id === "projects" || section.id === "education")
    .every((section) => section.type === "bullets"),
  true
);
const benQaContext = {
  job: { title: "AI Application Engineer", roleDomain: "software_ai_data", archetypeHint: "applied_ai_engineering" },
  candidateChunks: [
    {
      id: "chunk-rag",
      sourceType: "cv_upload",
      content:
        "Ben Smith built a document-grounded chatbot in Auckland from 2024 to 2025 using Python, TypeScript, RAG, embeddings, Node.js, PostgreSQL, pgvector, Prisma, Next.js, and React. Ben Smith also used JavaScript foundations for frontend and backend project work.",
    },
  ],
  gapAnswers: [{ id: "gap-usage", skipped: false }],
  matchAnalysis: batchFit,
};
const benQa = runDeterministicCvQa(cvBuilderOutput, benQaContext);
assert.deepEqual(benQa.issues, []);
assert.equal(benQa.passed, true);
const deterministicBenScore = calculateDeterministicAfterScore({
  output: cvBuilderOutput,
  qaPassed: benQa.passed,
  context: benQaContext,
});
assert.equal(deterministicBenScore >= 80, true);
assert.equal(deterministicBenScore <= 89, true);
assert.equal(deterministicBenScore === 71, false);

const workflowSource = readFileSync("src/server/services/applicationWorkflow.service.ts", "utf8");
for (const legacyName of [
  "runEvidenceScoringAgent",
  "runGapQuestionAgent",
  "runCvStrategyAgent",
  "runCvWriterAgent",
  "runCvQualityReviewAgent",
  "runCvLayoutStyleAgent",
  "runCvRewriteAgent",
]) {
  assert.equal(
    workflowSource.includes(legacyName),
    false,
    `${legacyName} must not be imported or called by the default workflow`
  );
}
assert.equal(/scoreRequirement\s*\(/.test(workflowSource), false);
assert.equal(
  workflowSource.indexOf("await db.evidenceMatch.deleteMany({ where: { applicationId: args.applicationId } })") <
    workflowSource.indexOf("await db.candidateChunk.deleteMany({"),
  true,
  "candidate chunk regeneration must delete dependent evidence matches first"
);
assert.equal(
  workflowSource.includes("buildEvidenceMatchPersistencePlan"),
  true,
  "batch fit persistence must validate agent chunk IDs before Prisma writes"
);
assert.equal(
  workflowSource.includes("taylor_rejected_evidence_matches"),
  true,
  "invalid agent chunk IDs should be logged as rejected matches"
);
assert.equal(
  workflowSource.includes("Something went wrong while scanning your background. Please try again."),
  true,
  "candidate scan errors should use a clean user-facing retry message"
);

const pageSource = readFileSync("src/app/page.tsx", "utf8");
assert.equal(pageSource.includes("final_export"), true);
assert.equal(pageSource.includes("CV Match Strength"), true);
assert.equal(pageSource.includes("profile_confirmation"), false);
assert.equal(pageSource.includes("honest_read"), false);
assert.equal(pageSource.includes("rewriteSection"), false);

const previewSource = readFileSync("src/components/CVPreview.tsx", "utf8");
assert.equal(previewSource.includes("border-blue-700"), false);

console.log("Acceptance fixtures passed.");
