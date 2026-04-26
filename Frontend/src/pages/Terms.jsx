export default function Terms() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 prose-styles">
      <h1 className="font-display text-4xl text-ink dark:text-gray-100">Terms of Service</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last updated: {new Date().toLocaleDateString()}</p>

      <Section title="Using VendorVerse">
        <p>By creating an account, you agree to use VendorVerse to source or fulfill ingredient orders in good faith. You are responsible for the accuracy of inventory you list and the legitimacy of orders you place.</p>
      </Section>

      <Section title="Vendor responsibilities">
        <ul>
          <li>Place orders only with the intent to receive and pay for them.</li>
          <li>Provide a real delivery address and contact details.</li>
          <li>Pay the supplier for delivered orders per the agreed price.</li>
        </ul>
      </Section>

      <Section title="Supplier responsibilities">
        <ul>
          <li>Only list items you can actually supply.</li>
          <li>Honor accepted orders within a reasonable time.</li>
          <li>Comply with applicable food safety and licensing rules (e.g. FSSAI).</li>
        </ul>
      </Section>

      <Section title="Disputes">
        <p>If an order goes wrong, contact us via the Help page. We will mediate but final resolution is between the vendor and the supplier.</p>
      </Section>

      <Section title="Termination">
        <p>We may suspend accounts that violate these terms. You can also delete your account at any time from your Profile page.</p>
      </Section>
    </article>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl text-ink dark:text-gray-100">{title}</h2>
      <div className="mt-2 text-gray-700 dark:text-gray-300 space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
