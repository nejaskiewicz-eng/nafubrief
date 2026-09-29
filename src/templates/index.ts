import type { Template } from '../lib/types'
import { legal } from './legal'
import { strategy } from './strategy'
import { technical } from './technical'
import { visual } from './visual'

export const TEMPLATES: Template[] = [strategy, legal, technical, visual]

export const templateByKey = (key: string) => TEMPLATES.find((t) => t.key === key)
