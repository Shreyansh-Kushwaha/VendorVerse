export default function Privacy() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 prose-styles">
      <h1 className="font-display text-4xl text-ink dark:text-gray-100">Privacy Policy</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last updated: {new Date().toLocaleDateString()}</p>

      <Section title="What we collect">
        <p>When you use VendorVerse we collect:</p>
        <ul>
          <li>Your name, email, business name and location, provided when you sign up.</li>
          <li>Items you list (suppliers) or order (vendors), including quantities and prices.</li>
          <li>Images you upload for inventory items, stored on Cloudinary.</li>
          <li>Basic technical information like your browser type and device for security and performance.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <p>We use your data to operate the platform — show items to vendors, route orders to suppliers, and let both sides communicate. We do not sell your personal data to third parties.</p>
      </Section>

      <Section title="Your rights">
        <p>You can edit your profile, change your password and permanently delete your account from the Profile page. Deletion removes your account, your inventory listings and your order history.</p>
      </Section>

      <Section title="Contact">
        <p>For privacy questions, email <a className="text-brand-700 dark:text-brand-400 hover:underline" href="mailto:privacy@vendorverse.app">privacy@vendorverse.app</a>.</p>
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
