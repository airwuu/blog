import type { IconMap, SocialLink, Site } from '@/types'

export const SITE: Site = {
  title: 'airwu.dev',
  description:
    'personal website',
  href: 'https://airwu.dev',
  author: 'airwu',
  locale: 'en-US',
  featuredPostCount: 2,
  postsPerPage: 4,
}

export const NAV_LINKS: SocialLink[] = [
  
  // {
  //   href: '/authors',
  //   label: 'authors',
  // },
  {
    href: '/experience',
    label: 'experience',
  },
  {
    href: '/blog',
    label: 'blog',
  },
  {
    href: '/hobbies',
    label: 'hobbies',
  },  
  {
    href: '/timeline',
    label: 'timeline',
  },
]

export const SOCIAL_LINKS: SocialLink[] = [
  {
    href: 'https://github.com/airwuu',
    label: 'GitHub',
  },
  // {
  //   href: 'https://twitter.com/enscry',
  //   label: 'Twitter',
  // },
  {
    href: 'mailto:awu0103@gmail.com',
    label: 'Email',
  },
  {
    href: '/rss.xml',
    label: 'RSS',
  },
]

export const ICON_MAP: IconMap = {
  Website: 'lucide:globe',
  GitHub: 'lucide:github',
  LinkedIn: 'lucide:linkedin',
  Twitter: 'lucide:twitter',
  Email: 'lucide:mail',
  RSS: 'lucide:rss',
}
