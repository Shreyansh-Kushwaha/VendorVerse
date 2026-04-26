export default function About() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="font-display text-4xl text-ink dark:text-gray-100">About VendorVerse</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-3">
        We're on a mission to digitize the everyday supply chain that powers Indian street food.
      </p>

      <section className="mt-8 prose-styles space-y-4 text-gray-700 dark:text-gray-300">
        <p>
          Every morning across India, lakhs of street food vendors pick up the phone or walk to the mandi to source their ingredients. The process is slow, prices vary wildly, and trustworthy suppliers are hard to find.
          VendorVerse is a single platform where vendors can browse, compare and order from local suppliers — and where suppliers can list their inventory and grow their customer base without endless WhatsApp threads.
        </p>
        <p>
          We started this project to solve a real problem we saw in our own neighborhoods. A bowl of pani puri at the corner stall depends on a long, fragile chain of suppliers that nobody had bothered to make easy.
        </p>
      </section>

      <section className="mt-10 grid sm:grid-cols-3 gap-4">
        <Pillar title="Trust" body="Every supplier is verified before listing. We promote suppliers with consistently good ratings." />
        <Pillar title="Fairness" body="We don't take a cut from vendors. Our incentives are aligned with the people we serve." />
        <Pillar title="Simplicity" body="The whole flow — discover, order, track — works on a phone in three minutes." />
      </section>
    </article>
  );
}

function Pillar({ title, body }) {
  return (
    <div className="card p-5">
      <h3 className="font-display text-xl text-brand-600 dark:text-brand-400">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{body}</p>
    </div>
  );
}
