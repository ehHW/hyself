import { chromium } from 'playwright'

const baseUrl = process.env.HYSELF_BASE_URL || 'http://127.0.0.1:5174'
const loginPath = '/login'
const password = 'SmokePass123!'
const browserChannel = process.env.HYSELF_BROWSER_CHANNEL || undefined

const roles = [
  {
    label: '普通用户',
    username: 'rbac_smoke_normal',
    checks: [
      {
        name: '聊天室消息页',
        path: '/chat-center/messages',
        expectedPath: '/chat-center/messages',
        expectTexts: ['聊天室'],
        forbid403Includes: ['/api/chat/group-join-requests/'],
      },
      {
        name: '群通知页只读',
        path: '/chat-center/contacts/notices',
        expectedPath: '/chat-center/contacts/notices',
        expectTexts: ['群通知'],
        expectTextsAny: ['当前没有需要你处理的入群申请', '暂无群通知', '暂无待处理入群申请'],
        absentTexts: ['通过', '拒绝'],
        forbid403Includes: ['/api/chat/group-join-requests/'],
      },
      {
        name: '聊天室快捷键设置',
        path: '/chat-center/settings/shortcuts',
        expectedPath: '/chat-center/settings/shortcuts',
        expectTexts: ['发送消息快捷键'],
      },
      {
        name: '资源中心上传页可用',
        path: '/file-manage?tab=upload',
        expectedPath: '/file-manage',
        expectTextsAny: ['选择文件', '拖拽文件或文件夹到这里'],
        absentTexts: ['当前为只读上传页'],
      },
      {
        name: '娱乐中心游戏页可进',
        path: '/entertainment/game/2048',
        expectedPath: '/entertainment/game/2048',
        expectTexts: ['游戏排行榜', '2048'],
      },
      {
        name: '娱乐中心音乐页可进',
        path: '/entertainment/music',
        expectedPath: '/entertainment/music',
        expectTexts: ['音乐'],
      },
      {
        name: '娱乐中心视频页可进',
        path: '/entertainment/video',
        expectedPath: '/entertainment/video',
        expectTexts: ['视频'],
      },
      {
        name: '用户中心无权跳回首页',
        path: '/user-manage',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
    ],
  },
  {
    label: '资源只读',
    username: 'rbac_smoke_resource',
    checks: [
      {
        name: '资源中心上传页只读',
        path: '/file-manage?tab=upload',
        expectedPath: '/file-manage',
        expectTexts: ['当前为只读上传页'],
      },
      {
        name: '娱乐中心无权跳回首页',
        path: '/entertainment/game/2048',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
      {
        name: '聊天室无权跳回首页',
        path: '/chat-center/messages',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
      {
        name: '用户中心无权跳回首页',
        path: '/user-manage',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
    ],
  },
  {
    label: '聊天管理员',
    username: 'rbac_smoke_chat_admin',
    checks: [
      {
        name: '资源中心无权跳回首页',
        path: '/file-manage',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
      {
        name: '娱乐中心无权跳回首页',
        path: '/entertainment/game/2048',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
      {
        name: '聊天室消息页',
        path: '/chat-center/messages',
        expectedPath: '/chat-center/messages',
        expectTexts: ['聊天室'],
      },
      {
        name: '群通知审批页',
        path: '/chat-center/contacts/notices',
        expectedPath: '/chat-center/contacts/notices',
        expectTexts: ['群通知'],
        allow403Includes: ['/api/chat/group-join-requests/'],
      },
      {
        name: '资源中心无权跳回首页',
        path: '/file-manage',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
      {
        name: '巡检模式无权跳回首页',
        path: '/chat-center/settings/inspect',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
      {
        name: '用户中心无权跳回首页',
        path: '/user-manage',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
    ],
  },
  {
    label: '游戏只读',
    username: 'rbac_smoke_game',
    checks: [
      {
        name: '资源中心无权跳回首页',
        path: '/file-manage',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
      {
        name: '娱乐中心排行榜只读',
        path: '/entertainment/game/2048',
        expectedPath: '/entertainment/game/2048',
        expectTexts: ['当前为排行榜只读模式', '游戏排行榜'],
      },
      {
        name: '聊天室无权跳回首页',
        path: '/chat-center/messages',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
      {
        name: '用户中心无权跳回首页',
        path: '/user-manage',
        expectedPath: '/home',
        expectToast: '当前页面无访问权限，已返回首页',
      },
    ],
  },
  {
    label: '超管',
    username: 'rbac_smoke_super',
    checks: [
      {
        name: '资源中心上传页可用',
        path: '/file-manage?tab=upload',
        expectedPath: '/file-manage',
        expectTextsAny: ['选择文件', '拖拽文件或文件夹到这里'],
      },
      {
        name: '娱乐中心音乐页可进',
        path: '/entertainment/music',
        expectedPath: '/entertainment/music',
        expectTexts: ['音乐'],
      },
      {
        name: '娱乐中心视频页可进',
        path: '/entertainment/video',
        expectedPath: '/entertainment/video',
        expectTexts: ['视频'],
      },
      {
        name: '聊天室巡检模式可进',
        path: '/chat-center/settings/inspect',
        expectedPath: '/chat-center/settings/inspect',
        expectTexts: ['隐身巡检模式'],
      },
      {
        name: '用户中心可进',
        path: '/user-manage',
        expectedPath: '/user-manage',
        expectTexts: ['新增用户'],
        expectSelectors: ['input[placeholder="按用户名/昵称/邮箱/电话搜索"]'],
        waitSelectors: ['input[placeholder="按用户名/昵称/邮箱/电话搜索"]'],
      },
    ],
  },
]

const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim()

async function login(page, username) {
  await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' })
  await page.locator('.ant-card-head-title', { hasText: 'Hyself 登录' }).waitFor({ timeout: 15000 })
  await page.getByPlaceholder('请输入用户名').fill(username)
  await page.getByPlaceholder('请输入密码').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/home$/, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

async function navigateInApp(page, path) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(700)
}

async function waitForCheckReady(page, check) {
  for (const selector of check.waitSelectors || []) {
    await page.locator(selector).first().waitFor({ timeout: 15000 })
  }
  for (const text of check.waitTexts || []) {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 })
  }
}

async function collectToastTexts(page) {
  const locator = page.locator('.ant-message-notice-content')
  const count = await locator.count()
  const texts = []
  for (let index = 0; index < count; index += 1) {
    texts.push(normalizeText(await locator.nth(index).innerText()))
  }
  return texts.filter(Boolean)
}

async function run() {
  const browser = await chromium.launch({ channel: browserChannel, headless: true })
  const report = []

  try {
    for (const role of roles) {
      const context = await browser.newContext()
      const page = await context.newPage()
      const api403s = []
      page.on('response', async (response) => {
        if (response.status() === 403 && response.url().includes('/api/')) {
          api403s.push(response.url())
        }
      })
      page.on('pageerror', (error) => {
        api403s.push(`PAGEERROR:${error.message}`)
      })

      await login(page, role.username)
      const roleResult = { role: role.label, checks: [] }

      for (const check of role.checks) {
        api403s.length = 0
        await navigateInApp(page, check.path)
        await waitForCheckReady(page, check)
        const currentPath = new URL(page.url()).pathname
        const bodyText = normalizeText(await page.locator('body').innerText())
        const toastTexts = await collectToastTexts(page)

        const failures = []
        if (currentPath !== check.expectedPath) {
          failures.push(`路径不符: expected ${check.expectedPath}, actual ${currentPath}`)
        }
        for (const text of check.expectTexts || []) {
          if (!bodyText.includes(text)) {
            failures.push(`缺少文案: ${text}`)
          }
        }
        for (const selector of check.expectSelectors || []) {
          const count = await page.locator(selector).count()
          if (count < 1) {
            failures.push(`缺少选择器: ${selector}`)
          }
        }
        if (check.expectTextsAny?.length) {
          if (!check.expectTextsAny.some((text) => bodyText.includes(text))) {
            failures.push(`缺少任一文案: ${check.expectTextsAny.join(' | ')}`)
          }
        }
        for (const text of check.absentTexts || []) {
          if (bodyText.includes(text)) {
            failures.push(`不应出现文案: ${text}`)
          }
        }
        if (check.expectToast) {
          if (!toastTexts.some((text) => text.includes(check.expectToast))) {
            failures.push(`未出现提示: ${check.expectToast}`)
          }
        }
        for (const needle of check.forbid403Includes || []) {
          if (api403s.some((url) => url.includes(needle))) {
            failures.push(`出现意外 403: ${needle}`)
          }
        }
        if (check.allow403Includes?.length) {
          const unexpected403 = api403s.filter((url) => !check.allow403Includes.some((needle) => url.includes(needle)))
          if (unexpected403.length) {
            failures.push(`出现未允许的 403: ${unexpected403.join(', ')}`)
          }
        } else if (api403s.length && !check.forbid403Includes?.length) {
          failures.push(`出现 403: ${api403s.join(', ')}`)
        }

        roleResult.checks.push({
          name: check.name,
          path: currentPath,
          toastTexts,
          api403s: [...api403s],
          failures,
        })
      }

      report.push(roleResult)
      await context.close()
    }
  } finally {
    await browser.close()
  }

  for (const roleResult of report) {
    console.log(`=== ${roleResult.role} ===`)
    for (const check of roleResult.checks) {
      console.log(`- ${check.name}`)
      console.log(`  path: ${check.path}`)
      console.log(`  toasts: ${check.toastTexts.length ? check.toastTexts.join(' | ') : '<none>'}`)
      console.log(`  api403s: ${check.api403s.length ? check.api403s.join(' | ') : '<none>'}`)
      console.log(`  result: ${check.failures.length ? `FAIL ${check.failures.join(' ; ')}` : 'PASS'}`)
    }
    console.log('')
  }

  const failed = report.flatMap((roleResult) => roleResult.checks.map((check) => ({ role: roleResult.role, check })).filter((item) => item.check.failures.length))
  if (failed.length) {
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
