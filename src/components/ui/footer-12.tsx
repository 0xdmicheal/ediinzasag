import { type FormEvent, type ReactNode } from 'react';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';

import { publicUrl } from '@/lib/public-url';

export interface Footer12Link {
  label: string;
  href: string;
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

export interface Footer12Props {
  newsletterTitle?: string;
  inputPlaceholder?: string;
  subscribeText?: string;
  onSubscribe?: (email: string) => void;
  columns?: Footer12Column[];
  brandName?: string;
  copyright?: string;
  socialLinks?: Footer12SocialLink[];
}

const columnLinkClass =
  'text-sm text-photo-foreground/70 transition-colors hover:text-photo-foreground';

const columnsDefault: Footer12Column[] = [];
const socialLinksDefault: Footer12SocialLink[] = [];

/**
 * Corporate footer: a fixed dark surface in both themes, so it reads as the
 * site's base rather than flipping with light/dark mode.
 */
export function Footer12({
  newsletterTitle = 'Долоо хоногийн тойм.',
  inputPlaceholder = 'И-мэйл хаяг',
  subscribeText = 'Subscribe',
  onSubscribe,
  columns = columnsDefault,
  brandName = 'Эдийн засаг',
  copyright = '© 2026 EZ Эдийн засаг',
  socialLinks = socialLinksDefault,
}: Footer12Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    onSubscribe?.(email);
  }

  return (
    <footer className="bg-studio text-photo-foreground w-full font-sans">
      <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-8">
        {/* Brand + navigation */}
        <div className="grid gap-12 border-b border-photo-foreground/10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
          <div>
            <img src={publicUrl('brand/logo-white.png')} alt={brandName} className="h-8 w-auto" />
            <p className="font-news mt-8 text-4xl leading-[1.05] sm:text-5xl">
              Эдийн засаг
              <span className="block text-photo-foreground/40 italic">is easy.</span>
            </p>
            <nav aria-label="Сувгууд" className="mt-8 flex flex-wrap gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.label}
                  className="grid size-9 place-items-center rounded-md border border-photo-foreground/15 text-photo-foreground/80 transition-colors hover:border-photo-foreground/40 hover:bg-photo-foreground/5 hover:text-photo-foreground"
                >
                  <span className="block leading-none [&_svg]:size-4">{link.icon}</span>
                </a>
              ))}
            </nav>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="text-xs font-semibold tracking-[0.12em] text-photo-foreground/50 uppercase">
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith('/') ? (
                        <Link to={link.href} className={columnLinkClass}>
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} target="_blank" rel="noreferrer" className={columnLinkClass}>
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Newsletter */}
        <div className="flex flex-col gap-5 border-b border-photo-foreground/10 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{newsletterTitle}</h2>
            <p className="mt-1 text-sm text-photo-foreground/55">Захиалга Substack дээр баталгаажна.</p>
          </div>
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <label htmlFor="footer-email" className="sr-only">
              {inputPlaceholder}
            </label>
            <input
              id="footer-email"
              name="email"
              type="email"
              placeholder={inputPlaceholder}
              className="h-11 w-full rounded-md border border-photo-foreground/15 bg-photo-foreground/5 px-4 text-sm text-photo-foreground outline-none placeholder:text-photo-foreground/40 focus:border-brand sm:w-80"
            />
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
            >
              {subscribeText}
              <ArrowRight className="size-4" />
            </button>
          </form>
        </div>

        {/* Legal bar */}
        <div className="flex flex-col gap-4 py-6 text-xs text-photo-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {copyright}
            <span className="mx-2">·</span>
            Нийтийн эх сурвалжид тулгуурласан тойм. Хөрөнгө оруулалтын зөвлөгөө биш.
          </p>
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
