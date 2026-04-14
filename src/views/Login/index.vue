<template>
    <div class="login-wrap">
        <a-card title="Hyself 登录" class="login-card">
            <a-form layout="vertical" :model="formState" @finish="handleSubmit">
                <a-form-item label="用户名" name="username" :rules="loginFormRules.username">
                    <a-input v-model:value="formState.username" placeholder="请输入用户名" />
                </a-form-item>
                <a-form-item label="密码" name="password" :rules="loginFormRules.password">
                    <a-input-password v-model:value="formState.password" placeholder="请输入密码" />
                </a-form-item>
                <a-form-item>
                    <a-button type="primary" html-type="submit" block :loading="loading">登录</a-button>
                </a-form-item>
            </a-form>
        </a-card>
    </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils/error'
import { loginFormRules } from '@/validators/formRules'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)

const formState = reactive({
    username: '',
    password: '',
})

const handleSubmit = async () => {
    try {
        loading.value = true
        await authStore.login(formState.username, formState.password)
        message.success('登录成功')
        router.push('/home')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '登录失败'))
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.login-wrap {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--surface-page);
}

.login-card {
    width: 360px;
}

:deep(.ant-card) {
    background: var(--surface-header);
    border-color: transparent;
}

:deep(.ant-card-head) {
    border-bottom-color: rgba(127, 127, 127, 0.2);
}

:deep(.ant-card-head-title) {
    color: var(--text-primary);
}

:deep(.ant-input),
:deep(.ant-input-password),
:deep(.ant-input-affix-wrapper) {
    background: color-mix(in srgb, var(--surface-header) 90%, #000 10%);
    border-color: color-mix(in srgb, var(--text-secondary) 45%, transparent);
    color: var(--text-primary);
}

:deep(.ant-form-item-label > label) {
    color: var(--text-primary);
}

:deep(.ant-input:hover),
:deep(.ant-input-affix-wrapper:hover),
:deep(.ant-input-affix-wrapper .ant-input:hover) {
    border-color: #1677ff;
}

:deep(.ant-input:focus),
:deep(.ant-input-focused),
:deep(.ant-input-affix-wrapper-focused),
:deep(.ant-input-affix-wrapper:focus-within) {
    border-color: #1677ff;
    box-shadow: 0 0 0 2px color-mix(in srgb, #1677ff 22%, transparent);
}

:deep(.ant-input::placeholder) {
    color: var(--text-secondary);
}

:deep(.ant-input-password .ant-input) {
    background: transparent;
    color: var(--text-primary);
}

:deep(.ant-input-affix-wrapper .ant-input-password-icon),
:deep(.ant-input-affix-wrapper .ant-input-suffix .anticon),
:deep(.ant-input-affix-wrapper .ant-input-suffix .anticon svg) {
    color: var(--text-secondary) !important;
}

:deep(.ant-input-affix-wrapper:hover .ant-input-password-icon),
:deep(.ant-input-affix-wrapper:hover .ant-input-suffix .anticon),
:deep(.ant-input-affix-wrapper:hover .ant-input-suffix .anticon svg),
:deep(.ant-input-affix-wrapper-focused .ant-input-password-icon),
:deep(.ant-input-affix-wrapper-focused .ant-input-suffix .anticon),
:deep(.ant-input-affix-wrapper-focused .ant-input-suffix .anticon svg) {
    color: #1677ff !important;
}
</style>
