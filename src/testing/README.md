# Testing

测试相关文件统一收口在 src/testing。

- contracts: 纯类型/契约检查文件，不参与运行时打包
- stores: store 层测试
- utils: 通用工具测试

约束：

- 运行时代码不要依赖 src/testing
- 业务组件/场景如果测试强依赖同目录模板语义，可以继续就近放置 spec
- 新增纯测试辅助或契约检查时，优先放到 src/testing，而不是 utils、stores 等运行目录
