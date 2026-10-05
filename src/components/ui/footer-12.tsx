import { type FormEvent, type ReactNode } from 'react';
import { ArrowRight, ArrowUp, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { publicUrl } from '@/lib/public-url';

export interface Footer12Link {
  label: string;
  href: string;
  /** One line under the label, for product-style columns. */
  description?: string;
}

export interface Footer12Column {
  title: string;
  links: Footer12Link[];
}

export interface Footer12SocialLink {
  label: string;
  href: string;
  icon: ReactNode;
}

export interface Footer12Notice {
  title: string;
  body: string;
}

export interface Footer12Props {
  brandName?: string;
  description?: string;
  newsletterLabel?: string;
  newsletterTitle?: string;
  newsletterNote?: string;
  inputPlaceholder?: string;
  subscribeText?: string;
  onSubscribe?: (email: string) => void;
  columns?: Footer12Column[];
  socialLinks?: Footer12SocialLink[];
  notices?: Footer12Notice[];
  copyright?: string;
}

const headingClass = 'text-[11px] font-semibold tracking-[0.16em] uppercase';

const columnsDefault: Footer12Column[] = [];
const socialLinksDefault: Footer12SocialLink[] = [];
const noticesDefault: Footer12Notice[] = [];

/**
 * Corporate footer: a fixed dark surface in both themes, so it reads as the
 * site's base rather than flipping with light/dark mode. Four bands, top to
 * bottom: newsletter, brand and site map, data notices, legal line.
 */
export function Footer12({
  brandName = 'Эдийн засаг',
  description,
  newsletterLabel = 'Нийтлэл',
  newsletterTitle = 'Долоо хоногийн тоймыг и-мэйлээр аваарай.',
  newsletterNote = 'Захиалга Substack дээр баталгаажна.',
  inputPlaceholder = 'И-мэйл хаяг',
  subscribeText = 'Subscribe',
  onSubscribe,
  columns = columnsDefault,
  socialLinks = socialLinksDefault,
  notices = noticesDefault,
  copyright = '© EZ Эдийн засаг',
}: Footer12Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    onSubscribe?.(email);
  }

  return (
    <footer className="bg-studio text-photo-foreground w-full border-t-2 border-brand font-sans">
      <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-8">
        {/* Newsletter */}
        <section
          aria-labelledby="footer-newsletter-title"
          className="grid gap-6 border-b border-photo-foreground/10 py-10 sm:py-12 lg:grid-cols-12 lg:items-center lg:gap-8"
        >
          <div className="lg:col-span-7">
            <p className={`${headingClass} text-brand`}>{newsletterLabel}</p>
            <h2
              id="footer-newsletter-title"
              className="mt-3 max-w-2xl text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-[1.75rem]"
            >
              {newsletterTitle}
            </h2>
          </div>
          <div className="lg:col-span-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="footer-email" className="sr-only">
                {inputPlaceholder}
              </label>
              <input
                id="footer-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={inputPlaceholder}
                className="h-12 w-full min-w-0 rounded-md border border-photo-foreground/15 bg-photo-foreground/5 px-4 text-sm text-photo-foreground outline-none transition-colors placeholder:text-photo-foreground/45 focus:border-brand sm:flex-1"
              />
              <button
                type="submit"
                className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-6 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {subscribeText}
                <ArrowRight className="size-4" />
              </button>
            </form>
            <p className="mt-3 text-xs text-photo-foreground/50">{newsletterNote}</p>
          </div>
        </section>

        {/* Brand + site map */}
        <div className="grid gap-12 border-b border-photo-foreground/10 py-12 lg:grid-cols-12 lg:gap-8 lg:py-14">
          <div className="lg:col-span-4 lg:pr-8">
            <Link to="/" className="inline-block" aria-label={brandName}>
              <img src={publicUrl('brand/logo-white.png')} alt="" className="h-8 w-auto" />
            </Link>
            {description && (
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-photo-foreground/60">{description}</p>
            )}
            {socialLinks.length > 0 && (
              <div className="mt-8">
                <p className={`${headingClass} text-photo-foreground/50`}>Биднийг дагах</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {socialLinks.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={link.label}
                        title={link.label}
                        className="grid size-9 place-items-center rounded-md border border-photo-foreground/15 text-photo-foreground/75 transition-colors hover:border-photo-foreground/40 hover:bg-photo-foreground/5 hover:text-photo-foreground"
                      >
                        <span className="block leading-none [&_svg]:size-4">{link.icon}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <nav
            aria-label="Сайтын цэс"
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:col-span-8"
          >
            {columns.map((column) => (
              // Columns with descriptions take the full row on phones so the notes don't wrap.
              <div
                key={column.title}
                className={column.links.some((link) => link.description) ? 'col-span-2 sm:col-span-1' : undefined}
              >
                <h3 className={`${headingClass} border-b border-photo-foreground/10 pb-3`}>{column.title}</h3>
                <ul className="mt-5 space-y-4">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Notices */}
        {notices.length > 0 && (
          <dl className="grid gap-6 border-b border-photo-foreground/10 py-8 text-xs leading-relaxed md:grid-cols-2 lg:gap-8">
            {notices.map((notice) => (
              <div key={notice.title}>
                <dt className="font-semibold text-photo-foreground/70">{notice.title}</dt>
                <dd className="mt-1.5 max-w-xl text-photo-foreground/55">{notice.body}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Legal line */}
        <div className="flex flex-col gap-4 py-6 text-xs text-photo-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>{copyright}</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 transition-colors hover:text-photo-foreground"
          >
            Дээш буцах
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ link }: { link: Footer12Link }) {
  const external = !link.href.startsWith('/');
  const body = (
    <>
      <span className="inline-flex items-center gap-1 text-sm text-photo-foreground/75 transition-colors group-hover:text-photo-foreground">
        {link.label}
        {external && <ArrowUpRight aria-hidden="true" className="size-3.5 opacity-50" />}
      </span>
      {link.description && (
        <span className="mt-0.5 block text-xs text-photo-foreground/50">{link.description}</span>
      )}
      {external && <span className="sr-only"> (шинэ цонхонд нээгдэнэ)</span>}
    </>
  );

  return external ? (
    <a href={link.href} target="_blank" rel="noreferrer" className="group block w-fit">
      {body}
    </a>
  ) : (
    <Link to={link.href} className="group block w-fit">
      {body}
    </Link>
  );
}
