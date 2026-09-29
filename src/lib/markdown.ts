import DOMPurify from 'dompurify'
import { marked } from 'marked'

/** Markdown → bezpieczny HTML (treść pochodzi od klientów i AI, więc zawsze sanitizujemy) */
export const renderMarkdown = (md: string) => DOMPurify.sanitize(marked.parse(md, { gfm: true, breaks: false, async: false }))
