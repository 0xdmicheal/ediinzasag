import { type FormEvent, type ReactNode } from 'react';
import { FaArrowRight } from 'react-icons/fa6';

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

const columnsDefault: Footer12Column[] = [];
const socialLinksDefault: Footer12SocialLink[] = [];

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
    <footer className="w-full border-t border-white/10 bg-neutral-950 font-sans text-white dark:border-neutral-950/10 dark:bg-[#f4f1ea] dark:text-neutral-950">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-10 sm:px-10 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(240px,380px)_1fr] lg:gap-16">
          <div>
            <img
              src={publicUrl('brand/logo-white.png')}
              alt={brandName}
              className="h-7 w-auto dark:hidden"
            />
            <img
              src={publicUrl('brand/logo-black.png')}
              alt=""
              className="hidden h-7 w-auto dark:block"
            />
            <h2 className="font-news mt-6 max-w-[22rem] text-[1.65rem] leading-[1.12]">
              {newsletterTitle}
            </h2>
            <form onSubmit={handleSubmit} className="mt-6 max-w-sm">
              <input
                name="email"
                type="email"
                placeholder={inputPlaceholder}
                className="h-11 w-full border-b border-white/70 bg-transparent text-sm text-white outline-none placeholder:text-white/45 dark:border-neutral-950 dark:text-neutral-950 dark:placeholder:text-neutral-500"
              />
              <button
                type="submit"
                className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 bg-white px-4 text-sm text-neutral-950 dark:bg-neutral-950 dark:text-white"
              >
                <span>{subscribeText}</span>
                <FaArrowRight className="size-3.5" />
              </button>
            </form>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
            {columns.map((column, index) => (
              <div key={column.title}>
                <h3 className="text-[11px] tracking-[0.2em] text-white/45 uppercase dark:text-neutral-500">
                  <span className="mr-2">0{index + 1}</span>
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target={link.href.startsWith('http') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                        className="text-sm text-white/80 hover:text-white hover:underline dark:text-neutral-800 dark:hover:text-neutral-950"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-8 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-950/10">
          <nav aria-label="Сувгууд" className="flex flex-wrap items-center gap-5">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                aria-label={link.label}
                className="text-white transition-opacity hover:opacity-60 dark:text-neutral-950"
              >
                <span className="block leading-none [&_svg]:size-5">{link.icon}</span>
              </a>
            ))}
          </nav>
          <p className="text-sm text-white/55 dark:text-neutral-600">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
