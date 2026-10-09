import { type ReactNode } from 'react';
import { ArrowUp, ArrowUpRight } from 'lucide-react';
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
  columns?: Footer12Column[];
  socialLinks?: Footer12SocialLink[];
  notices?: Footer12Notice[];
  copyright?: string;
}

const headingClass = 'text-[11px] font-semibold tracking-[0.16em] uppercase';

const columnsDefault: Footer12Column[] = [];
const socialLinksDefault: Footer12SocialLink[] = [];
const noticesDefault: Footer12Notice[] = [];

/** Brand colour for each social mark on hover. X is black in light and white in dark, which is the mark itself. */
const socialHover: Record<string, string> = {
  YouTube: 'hover:border-[#ff0000]/40 hover:bg-[#ff0000]/10 hover:text-[#ff0000]',
  Facebook: 'hover:border-[#1877f2]/40 hover:bg-[#1877f2]/10 hover:text-[#1877f2]',
  Instagram: 'hover:border-[#c13584]/40 hover:bg-[#c13584]/10 hover:text-[#c13584] dark:hover:border-[#e4405f]/40 dark:hover:text-[#e4405f]',
  Telegram: 'hover:border-[#168acd]/40 hover:bg-[#168acd]/10 hover:text-[#168acd] dark:hover:border-[#2aabee]/40 dark:hover:text-[#2aabee]',
  X: 'hover:border-foreground/30 hover:bg-foreground/8 hover:text-foreground',
};

/**
 * Footer follows the page appearance: paper and black wordmark in light,
 * near-black and white wordmark in dark. Bands: brand and site map, data notices, legal line.
 */
export function Footer12({
  brandName = 'Эдийн засаг',
  description,
  columns = columnsDefault,
  socialLinks = socialLinksDefault,
  notices = noticesDefault,
  copyright = '© EZ Эдийн засаг',
}: Footer12Props) {
  return (
    <footer className="bg-background text-foreground w-full border-t border-border font-sans">
      <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-8">
        {/* Brand + site map */}
        <div className="grid gap-12 border-b border-border py-12 lg:grid-cols-12 lg:gap-8 lg:py-14">
          <div className="lg:col-span-4 lg:pr-8">
            <Link to="/" className="inline-block" aria-label={brandName}>
              <img src={publicUrl('brand/logo-black.png')} alt="" className="h-8 w-auto dark:hidden" />
              <img src={publicUrl('brand/logo-white.png')} alt="" className="hidden h-8 w-auto dark:block" />
            </Link>
            {description && (
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
            )}
            {socialLinks.length > 0 && (
              <div className="mt-8">
                <p className={`${headingClass} text-muted-foreground`}>Биднийг дагах</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {socialLinks.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={link.label}
                        title={link.label}
                        className={`grid size-11 place-items-center rounded-md border border-border text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${socialHover[link.label] ?? 'hover:border-foreground/30 hover:text-foreground'}`}
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
                <h3 className={`${headingClass} border-b border-border pb-3`}>{column.title}</h3>
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
          <dl className="grid gap-6 border-b border-border py-8 text-xs leading-relaxed md:grid-cols-2 lg:gap-8">
            {notices.map((notice) => (
              <div key={notice.title}>
                <dt className="font-semibold text-foreground">{notice.title}</dt>
                <dd className="mt-1.5 max-w-xl text-muted-foreground">{notice.body}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Legal line */}
        <div className="flex flex-col gap-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{copyright}</p>
          <button
            type="button"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              })
            }
            className="ez-hit inline-flex w-fit cursor-pointer items-center gap-1.5 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
      <span className="inline-flex items-center gap-1 text-sm text-foreground/80 transition-colors group-hover:text-foreground">
        {link.label}
        {external && <ArrowUpRight aria-hidden="true" className="size-3.5 opacity-50" />}
      </span>
      {link.description && (
        <span className="mt-0.5 block text-xs text-muted-foreground">{link.description}</span>
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
