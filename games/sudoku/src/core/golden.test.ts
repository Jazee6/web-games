import { expect, test } from "bun:test"
import golden from "./fixtures/golden.json"
import { goldenHashes } from "./golden"

// 哈希变了说明规则或生成器变了：必须递增 kernel.version 或新增生成器版本，不能直接改金标。
test("回放金标与已提交的哈希一致", () => {
  expect(goldenHashes()).toEqual(golden)
})
