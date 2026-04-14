import instance from '@/utils/request'
import type { ListResult, LoginResponse, PermissionContext, PermissionItem, RoleItem, UserItem } from '@/types/user'

export const loginApi = (payload: { username: string; password: string }) => {
    return instance.post<LoginResponse>('auth/login/', payload)
}

export const refreshTokenApi = (refresh: string) => {
    return instance.post<{ access: string; refresh?: string }>('auth/refresh/', { refresh })
}

export const profileApi = () => {
    return instance.get<UserItem>('auth/profile/')
}

export const permissionContextApi = () => {
    return instance.get<PermissionContext>('auth/permission-context/')
}

export const updateProfileApi = (payload: {
    email?: string
    display_name?: string
    avatar?: string
    phone_number?: string
}) => {
    return instance.patch<UserItem>('auth/profile/', payload)
}

export const changePasswordApi = (payload: {
    current_password: string
    new_password: string
    confirm_password: string
}) => {
    return instance.post<{ detail: string }>('auth/change-password/', payload)
}

export const getUsersApi = (params?: {
    page?: number
    page_size?: number
    keyword?: string
    created_from?: string
    created_to?: string
}) => {
    return instance.get<ListResult<UserItem>>('users/', { params })
}

export const createUserApi = (payload: {
    username: string
    password: string
    email?: string
    display_name?: string
    avatar?: string
    phone_number?: string
    is_active?: boolean
    is_staff?: boolean
    is_superuser?: boolean
    role_ids?: number[]
}) => {
    return instance.post<UserItem>('users/', payload)
}

export const updateUserApi = (
    id: number,
    payload: {
        email?: string
        display_name?: string
        avatar?: string
        phone_number?: string
        is_active?: boolean
        is_staff?: boolean
        is_superuser?: boolean
        password?: string
        role_ids?: number[]
    },
) => {
    return instance.patch<UserItem>(`users/${id}/`, payload)
}

export const deleteUserApi = (id: number) => {
    return instance.delete(`users/${id}/`)
}

export const kickoutUserApi = (id: number) => {
    return instance.post<{ detail: string }>(`users/${id}/kickout/`)
}

export const getRolesApi = (params?: { page?: number; page_size?: number; keyword?: string }) => {
    return instance.get<ListResult<RoleItem>>('roles/', { params })
}

export const createRoleApi = (payload: { name: string; description?: string; permission_ids?: number[] }) => {
    return instance.post<RoleItem>('roles/', payload)
}

export const updateRoleApi = (id: number, payload: { name?: string; description?: string; permission_ids?: number[] }) => {
    return instance.patch<RoleItem>(`roles/${id}/`, payload)
}

export const deleteRoleApi = (id: number) => {
    return instance.delete(`roles/${id}/`)
}

export const getPermissionsApi = (params?: { page?: number; page_size?: number; keyword?: string }) => {
    return instance.get<ListResult<PermissionItem>>('permissions/', { params })
}

export const createPermissionApi = (payload: { code: string; name: string; description?: string }) => {
    return instance.post<PermissionItem>('permissions/', payload)
}

export const updatePermissionApi = (id: number, payload: { code?: string; name?: string; description?: string }) => {
    return instance.patch<PermissionItem>(`permissions/${id}/`, payload)
}

export const deletePermissionApi = (id: number) => {
    return instance.delete(`permissions/${id}/`)
}
