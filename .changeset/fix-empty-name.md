---
"async-task-mapping": patch
---

修复 `TaskList.pushResolve(data, "")` 会静默忽略空字符串 `name` 的问题:现在空字符串也是合法 key,数据会进入 `dataMap[""]`。
