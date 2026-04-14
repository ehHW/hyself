type HasPermissionFn = (code: string) => boolean

const hasOnlyViewAccess = (
    viewCode: string,
    mutateCodes: string[],
    hasPermission: HasPermissionFn,
) => hasPermission(viewCode) && mutateCodes.every((code) => !hasPermission(code))

export const resolveMenuDisplayTitle = (
    menuKey: string | undefined,
    fallbackTitle: string,
    hasPermission: HasPermissionFn,
) => {
    if (!menuKey) {
        return fallbackTitle
    }

    if (
        menuKey === 'user_manage' &&
        hasOnlyViewAccess(
            'user.view_user',
            ['user.create_user', 'user.update_user', 'user.delete_user'],
            hasPermission,
        )
    ) {
        return '用户列表'
    }

    if (
        menuKey === 'role_manage' &&
        hasOnlyViewAccess(
            'user.view_role',
            ['user.create_role', 'user.update_role', 'user.delete_role'],
            hasPermission,
        )
    ) {
        return '角色列表'
    }

    if (
        menuKey === 'permission_manage' &&
        hasOnlyViewAccess(
            'user.view_permission',
            [
                'user.create_permission',
                'user.update_permission',
                'user.delete_permission',
            ],
            hasPermission,
        )
    ) {
        return '权限列表'
    }

    return fallbackTitle
}