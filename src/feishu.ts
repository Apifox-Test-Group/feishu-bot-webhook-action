import * as https from 'https'
import * as crypto from 'crypto'
import * as core from '@actions/core'

export function sign_with_timestamp(timestamp: number, key: string): string {
  const toencstr = `${timestamp}\n${key}`
  const signature = crypto.createHmac('SHA256', toencstr).digest('base64')
  return signature
}

function buildWebhookUrl(webhook: string): URL {
  const trimmed = webhook.trim()
  if (!trimmed) {
    throw new Error('Feishu webhook is empty. Please set webhook input or FEISHU_BOT_WEBHOOK env.')
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return new URL(trimmed)
  }

  const hookIndex = trimmed.indexOf('hook/')
  const token = hookIndex >= 0 ? trimmed.slice(hookIndex + 5) : trimmed
  return new URL(`https://open.feishu.cn/open-apis/bot/v2/hook/${token}`)
}

export async function PostToFeishu(
  webhook: string,
  content: string
): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const webhookUrl = buildWebhookUrl(webhook)
    const chunks: Buffer[] = []
    const options = {
      hostname: webhookUrl.hostname,
      port: 443,
      path: `${webhookUrl.pathname}${webhookUrl.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }
    const req = https.request(options, res => {
      const statusCode = res.statusCode
      res.on('data', d => {
        chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d))
      })

      res.on('end', () => {
        const result = Buffer.concat(chunks).toString()
        if (result) {
          process.stdout.write(result)
          try {
            const json = JSON.parse(result)
            core.debug(json.code)
            core.debug(json.msg)
          } catch (err) {
            console.log(err)
          }
        }
        if (!statusCode || statusCode < 200 || statusCode >= 300) {
          reject(new Error(`Feishu webhook request failed with status ${statusCode}: ${result}`))
          return
        }
        resolve(statusCode)
      })
    })
    req.on('error', e => {
      console.error(e)
      reject(e)
    })
    req.write(content)
    req.end()
  })
}
