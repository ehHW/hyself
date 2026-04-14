import { chromium } from 'playwright'

const baseUrl = process.env.HYSELF_BASE_URL || 'http://127.0.0.1:5174'
const password = 'SmokePass123!'
const browserChannel = process.env.HYSELF_BROWSER_CHANNEL || undefined

const roleScenarios = [
  {
    label: '普通用户',
    username: 'rbac_smoke_normal',
    expectedPath: '/entertainment/game/2048',
    expectTexts: ['游戏排行榜', '2048'],
  },
  {
    label: '资源只读',
    username: 'rbac_smoke_resource',
    expectedPath: '/home',
  },
  {
    label: '游戏只读',
    username: 'rbac_smoke_game',
    expectedPath: '/entertainment/game/2048',
    expectTexts: ['当前为排行榜只读模式', '游戏排行榜'],
  },
  {
    label: '超管',
    username: 'rbac_smoke_super',
    expectedPath: '/entertainment/game/2048',
    expectTexts: ['游戏排行榜', '2048'],
  },
]

const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim()

async function login(page, username) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
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

async function collectToastTexts(page) {
  const locator = page.locator('.ant-message-notice-content')
  const count = await locator.count()
  const texts = []
  for (let index = 0; index < count; index += 1) {
    texts.push(normalizeText(await locator.nth(index).innerText()))
  }
  return texts.filter(Boolean)
}

async function assertErrorLayout(page, sourcePath) {
  await page.locator('.error-view').waitFor({ timeout: 15000 })
  await page.locator('.error-view__card').waitFor({ timeout: 15000 })
  const bodyText = normalizeText(await page.locator('body').innerText())
  for (const text of ['404', '页面不存在或已被移动', '返回首页', '返回上一页']) {
    if (!bodyText.includes(text)) {
      throw new Error(`${sourcePath}: 缺少错误页文案 ${text}`)
    }
  }
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('.error-view')
    const card = document.querySelector('.error-view__card')
    if (!(root instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      return null
    }
    const rootRect = root.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      rootWidth: rootRect.width,
      rootHeight: rootRect.height,
      cardCenterX: cardRect.left + cardRect.width / 2,
      cardCenterY: cardRect.top + cardRect.height / 2,
      viewportCenterX: window.innerWidth / 2,
      viewportCenterY: window.innerHeight / 2,
    }
  })
  if (!metrics) {
    throw new Error(`${sourcePath}: 无法获取错误页布局信息`)
  }
  if (metrics.rootHeight < metrics.viewportHeight - 2) {
    throw new Error(`${sourcePath}: 错误页未占满视口高度，${metrics.rootHeight} < ${metrics.viewportHeight}`)
  }
  if (metrics.rootWidth < metrics.viewportWidth - 2) {
    throw new Error(`${sourcePath}: 错误页未占满视口宽度，${metrics.rootWidth} < ${metrics.viewportWidth}`)
  }
  if (Math.abs(metrics.cardCenterX - metrics.viewportCenterX) > 24) {
    throw new Error(`${sourcePath}: 错误页卡片未水平居中`)
  }
  if (Math.abs(metrics.cardCenterY - metrics.viewportCenterY) > 24) {
    throw new Error(`${sourcePath}: 错误页卡片未垂直居中`)
  }
}

async function assertMissingRouteRedirect(page) {
  await navigateInApp(page, '/this-route-should-not-exist')
  await page.waitForURL(/\/404$/, { timeout: 15000 })
  await assertErrorLayout(page, '/this-route-should-not-exist')
}

async function assertDirectErrorRoute(page) {
  await navigateInApp(page, '/404')
  await page.waitForURL(/\/404$/, { timeout: 15000 })
  await assertErrorLayout(page, '/404')
}

async function assertEntertainmentLanding(page, scenario) {
  await navigateInApp(page, '/entertainment')
  const currentPath = new URL(page.url()).pathname
  if (currentPath !== scenario.expectedPath) {
    throw new Error(`${scenario.label}: 娱乐中心落地路径不符，expected ${scenario.expectedPath}, actual ${currentPath}`)
  }
  const bodyText = normalizeText(await page.locator('body').innerText())
  const toastTexts = await collectToastTexts(page)
  for (const text of scenario.expectTexts || []) {
    if (!bodyText.includes(text)) {
      throw new Error(`${scenario.label}: 娱乐中心缺少文案 ${text}`)
    }
  }
  if (scenario.expectToast && !toastTexts.some((text) => text.includes(scenario.expectToast))) {
    throw new Error(`${scenario.label}: 娱乐中心缺少提示 ${scenario.expectToast}`)
  }
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await login(page, scenario.username)
    await assertDirectErrorRoute(page)
    await assertMissingRouteRedirect(page)
    await assertEntertainmentLanding(page, scenario)
    console.log(`PASS ${scenario.label}: 错误页布局与娱乐中心落地正常`)
  } finally {
    await context.close()
  }
}

async function run() {
  const browser = await chromium.launch({ channel: browserChannel, headless: true })
  try {
    for (const scenario of roleScenarios) {
      await runScenario(browser, scenario)
    }
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})