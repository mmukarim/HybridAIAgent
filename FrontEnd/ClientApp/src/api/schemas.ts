import { z } from 'zod'

export const healthSchema = z.object({
  status: z.string(),
  application: z.string(),
})

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  dataset_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const conversationListSchema = z.object({
  conversations: z.array(conversationSchema),
  total: z.number(),
})

export const messageResponseSchema = z.object({
  conversation_id: z.string(),
  message: z.string(),
  response: z.string(),
})

export const messageHistorySchema = z.object({
  conversation_id: z.string(),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  total: z.number(),
})

export const fileSchema = z.object({
  id: z.string(),
  original_filename: z.string(),
  content_type: z.string().nullable(),
  file_size: z.number(),
  created_at: z.string(),
})

export const fileListSchema = z.object({
  files: z.array(fileSchema),
  total: z.number(),
})

export const datasetLoadSchema = z.object({
  dataset_id: z.string(),
  filename: z.string(),
  rows: z.number(),
  columns: z.number(),
  column_names: z.array(z.string()),
  file_size: z.number(),
})

export type Health = z.infer<typeof healthSchema>
export type Conversation = z.infer<typeof conversationSchema>
export type MessageHistory = z.infer<typeof messageHistorySchema>
export type UploadedFile = z.infer<typeof fileSchema>
export type DatasetLoad = z.infer<typeof datasetLoadSchema>
