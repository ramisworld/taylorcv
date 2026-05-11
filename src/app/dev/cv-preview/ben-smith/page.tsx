const projects = [
  {
    name: "Document Q&A Assistant",
    bullets: [
      "Built a retrieval-backed assistant that connects source documents with concise answers and visible source context.",
      "Used PostgreSQL, pgvector, Next.js, and TypeScript to connect retrieval with a usable product flow.",
      "Kept answer wording grounded in supplied documents to reduce unsupported responses.",
    ],
  },
  {
    name: "RAG Support Chatbot",
    bullets: [
      "Built a document-grounded chatbot with retrieval, source context, response debugging, and practical backend integration.",
    ],
  },
];

const skills = [
  ["Languages", "Python, TypeScript, JavaScript"],
  ["AI / LLM", "RAG, embeddings, structured outputs, prompt debugging"],
  ["Backend / Data", "Node.js, PostgreSQL, pgvector, Prisma, tRPC"],
  ["Frontend", "Next.js, React"],
];

export default function BenSmithCvPreview() {
  return (
    <main className="min-h-screen bg-zinc-200 px-6 py-8">
      <article
        className="mx-auto min-h-[1123px] max-w-[794px] bg-white px-12 py-10 font-sans text-[#18181b] shadow-xl"
        data-cv-document
        data-layout-architecture="premium_hybrid"
      >
        <header>
          <h1 className="text-[32px] font-bold leading-[1.05]">Ben Smith</h1>
          <p className="mt-1 text-[13.5px] font-semibold leading-5">
            Applied AI / Backend Engineer
          </p>
          <p className="mt-1 text-[12px] leading-5 text-zinc-600">
            Auckland | ben@example.com | GitHub: github.com/ben-smith
          </p>
        </header>

        <div className="mt-6 grid gap-4">
          <section>
            <h2 className="border-b border-zinc-200 pb-1.5 text-[12.5px] font-bold uppercase text-blue-700">
              Professional Summary
            </h2>
            <p className="mt-2 text-[12px] leading-[1.48]">
              Early-career applied AI/backend engineer with hands-on LLM, RAG,
              chatbot, and TypeScript product evidence. Strongest in
              document-grounded AI workflows, response-quality debugging, and
              backend foundations.
            </p>
          </section>

          <section>
            <h2 className="border-b border-zinc-200 pb-1.5 text-[12.5px] font-bold uppercase text-blue-700">
              Selected Projects
            </h2>
            <div className="mt-2 grid gap-3">
              {projects.map((project) => (
                <div key={project.name}>
                  <p className="text-[12.5px] font-semibold">{project.name}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] leading-[1.38]">
                    {project.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="border-b border-zinc-200 pb-1.5 text-[12.5px] font-bold uppercase text-blue-700">
              Experience
            </h2>
            <p className="mt-2 text-[12.5px] font-semibold">
              AI Application Builder | Auckland | 2024 - 2025
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] leading-[1.38]">
              <li>
                Delivered working MVP flows that connect model outputs,
                database writes, and user-facing interfaces.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="border-b border-zinc-200 pb-1.5 text-[12.5px] font-bold uppercase text-blue-700">
              Technical Skills
            </h2>
            <dl className="mt-2 space-y-1 text-[12px] leading-[1.38]">
              {skills.map(([label, value]) => (
                <div className="grid grid-cols-[128px_1fr] gap-2" key={label}>
                  <dt className="font-semibold text-blue-700">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="border-b border-zinc-200 pb-1.5 text-[12.5px] font-bold uppercase text-blue-700">
              Education
            </h2>
            <p className="mt-2 text-[12px] leading-[1.38]">
              Relevant coursework and practical AI/backend project work.
            </p>
          </section>

          <section>
            <h2 className="border-b border-zinc-200 pb-1.5 text-[12.5px] font-bold uppercase text-blue-700">
              Certifications
            </h2>
            <p className="mt-2 text-[12px] leading-[1.38]">
              Compact, role-relevant certifications only.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
