// Bug Speedrunner challenge bank. Each base broken/solution program is 50-60 lines before the per-run variant marker.
window.BUG_SPEEDRUNNER_CHALLENGES = [
  {
    "id": "js-inventory-01",
    "language": "javascript",
    "title": "Inventory Total",
    "difficulty": "Easy",
    "timeLimitMs": 180000,
    "broken": "const cart = [\n  { name: 'Keyboard', price: 49, quantity: 2 },\n  { name: 'Mouse', price: 25, quantity: 1 },\n  { name: 'Monitor', price: 180, quantity: 2 },\n  { name: 'USB Hub', price: 22, quantity: 3 },\n];\n\nfunction calculateSubtotal(items) {\n  let subtotal = 0;\n  for (let i = 0; i < items.length; i++) {\n    const item = items[i];\n    subtotal += item.price;\n  }\n  return subtotal;\n}\n\nfunction calculateDiscount(subtotal) {\n  if (subtotal >= 300) {\n    return subtotal * 0.15;\n  }\n  if (subtotal >= 150) {\n    return subtotal * 0.08;\n  }\n  return 0;\n}\n\nfunction buildReceipt(items) {\n  const subtotal = calculateSubtotal(items);\n  const discount = calculateDiscount(subtotal);\n  const shipping = subtotal >= 200 ? 0 : 12;\n  const total = subtotal - discount + shipping;\n\n  return {\n    subtotal,\n    discount,\n    shipping,\n    total,\n  };\n}\n\nfunction formatMoney(value) {\n  return `$${value.toFixed(2)}`;\n}\n\nconst receipt = buildReceipt(cart);\nconsole.log('SUBTOTAL:', formatMoney(receipt.subtotal));\nconsole.log('DISCOUNT:', formatMoney(receipt.discount));\nconsole.log('SHIPPING:', formatMoney(receipt.shipping));\nconsole.log('TOTAL:', formatMoney(receipt.total));\n\nconst expectedTotal = 389.50;\nif (Math.abs(receipt.total - expectedTotal) < 0.001) {\n  console.log('CHECK: PASS');\n} else {\n  console.log('CHECK: FAIL');\n}\n\n// The speedrun ends when the calculation matches the expected total.",
    "solution": "const cart = [\n  { name: 'Keyboard', price: 49, quantity: 2 },\n  { name: 'Mouse', price: 25, quantity: 1 },\n  { name: 'Monitor', price: 180, quantity: 2 },\n  { name: 'USB Hub', price: 22, quantity: 3 },\n];\n\nfunction calculateSubtotal(items) {\n  let subtotal = 0;\n  for (let i = 0; i < items.length; i++) {\n    const item = items[i];\n    subtotal += item.price * item.quantity;\n  }\n  return subtotal;\n}\n\nfunction calculateDiscount(subtotal) {\n  if (subtotal >= 300) {\n    return subtotal * 0.15;\n  }\n  if (subtotal >= 150) {\n    return subtotal * 0.08;\n  }\n  return 0;\n}\n\nfunction buildReceipt(items) {\n  const subtotal = calculateSubtotal(items);\n  const discount = calculateDiscount(subtotal);\n  const shipping = subtotal >= 200 ? 0 : 12;\n  const total = subtotal - discount + shipping;\n\n  return {\n    subtotal,\n    discount,\n    shipping,\n    total,\n  };\n}\n\nfunction formatMoney(value) {\n  return `$${value.toFixed(2)}`;\n}\n\nconst receipt = buildReceipt(cart);\nconsole.log('SUBTOTAL:', formatMoney(receipt.subtotal));\nconsole.log('DISCOUNT:', formatMoney(receipt.discount));\nconsole.log('SHIPPING:', formatMoney(receipt.shipping));\nconsole.log('TOTAL:', formatMoney(receipt.total));\n\nconst expectedTotal = 389.50;\nif (Math.abs(receipt.total - expectedTotal) < 0.001) {\n  console.log('CHECK: PASS');\n} else {\n  console.log('CHECK: FAIL');\n}\n\n// The speedrun ends when the calculation matches the expected total.",
    "bugs": [
      {
        "line": 13,
        "reason": "Subtotal adds only the unit price and ignores quantity.",
        "concept": "Multiply unit price by quantity for line-item totals."
      }
    ]
  },
  {
    "id": "js-login-02",
    "language": "javascript",
    "title": "Login Attempts",
    "difficulty": "Medium",
    "timeLimitMs": 180000,
    "broken": "const attempts = [\n  { user: 'neo', success: false },\n  { user: 'neo', success: false },\n  { user: 'trinity', success: true },\n  { user: 'neo', success: false },\n  { user: 'smith', success: false },\n];\n\nfunction countFailedAttempts(events, username) {\n  let failed = 0;\n  for (const event of events) {\n    if (event.user === username && event.success = false) {\n      failed++;\n    }\n  }\n  return failed;\n}\n\nfunction shouldLockAccount(events, username) {\n  const failed = countFailedAttempts(events, username);\n  return failed >= 3;\n}\n\nfunction securityReport(events, users) {\n  return users.map((username) => ({\n    username,\n    failed: countFailedAttempts(events, username),\n    locked: shouldLockAccount(events, username),\n  }));\n}\n\nconst report = securityReport(attempts, ['neo', 'trinity', 'smith']);\nfor (const row of report) {\n  console.log(row.username, row.failed, row.locked);\n}\n\nconst neo = report.find((row) => row.username === 'neo');\nconst smith = report.find((row) => row.username === 'smith');\n\nif (neo.failed === 3 && neo.locked === true && smith.failed === 1) {\n  console.log('CHECK: PASS');\n} else {\n  console.log('CHECK: FAIL');\n}\n\nconsole.log('Audit complete.');\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable",
    "solution": "const attempts = [\n  { user: 'neo', success: false },\n  { user: 'neo', success: false },\n  { user: 'trinity', success: true },\n  { user: 'neo', success: false },\n  { user: 'smith', success: false },\n];\n\nfunction countFailedAttempts(events, username) {\n  let failed = 0;\n  for (const event of events) {\n    if (event.user === username && event.success === false) {\n      failed++;\n    }\n  }\n  return failed;\n}\n\nfunction shouldLockAccount(events, username) {\n  const failed = countFailedAttempts(events, username);\n  return failed >= 3;\n}\n\nfunction securityReport(events, users) {\n  return users.map((username) => ({\n    username,\n    failed: countFailedAttempts(events, username),\n    locked: shouldLockAccount(events, username),\n  }));\n}\n\nconst report = securityReport(attempts, ['neo', 'trinity', 'smith']);\nfor (const row of report) {\n  console.log(row.username, row.failed, row.locked);\n}\n\nconst neo = report.find((row) => row.username === 'neo');\nconst smith = report.find((row) => row.username === 'smith');\n\nif (neo.failed === 3 && neo.locked === true && smith.failed === 1) {\n  console.log('CHECK: PASS');\n} else {\n  console.log('CHECK: FAIL');\n}\n\nconsole.log('Audit complete.');\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable\n// keep the battlefield stable",
    "bugs": [
      {
        "line": 13,
        "reason": "Assignment (`=`) changes the success value instead of comparing it.",
        "concept": "Use strict equality (`===`) for boolean comparison."
      }
    ]
  },
  {
    "id": "html-profile-01",
    "language": "html",
    "title": "Profile Card",
    "difficulty": "Easy",
    "timeLimitMs": 180000,
    "broken": "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>Speedrunner Profile</title>\n</head>\n<body>\n  <main class=\"profile\">\n    <article class=\"card\">\n      <header>\n        <h1>Rin</h1>\n        <p>Frontend Speedrunner</p>\n      </header>\n      <section>\n        <h2>Stats</h2>\n        <ul>\n          <li>Best Run: 01:42.382</li>\n          <li>Languages: 4</li>\n          <li>Streak: 12 days\n        </ul>\n      </section>\n      <section>\n        <h2>About</h2>\n        <p>Fix the broken markup without changing the text.</p>\n      </section>\n      <footer>\n        <a href=\"#contact\">Contact runner</a>\n      </footer>\n    </article>\n  </main>\n</body>\n</html>\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->",
    "solution": "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>Speedrunner Profile</title>\n</head>\n<body>\n  <main class=\"profile\">\n    <article class=\"card\">\n      <header>\n        <h1>Rin</h1>\n        <p>Frontend Speedrunner</p>\n      </header>\n      <section>\n        <h2>Stats</h2>\n        <ul>\n          <li>Best Run: 01:42.382</li>\n          <li>Languages: 4</li>\n          <li>Streak: 12 days</li>\n        </ul>\n      </section>\n      <section>\n        <h2>About</h2>\n        <p>Fix the broken markup without changing the text.</p>\n      </section>\n      <footer>\n        <a href=\"#contact\">Contact runner</a>\n      </footer>\n    </article>\n  </main>\n</body>\n</html>\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->",
    "bugs": [
      {
        "line": 20,
        "reason": "The third list item is missing its closing `</li>` tag.",
        "concept": "Keep paired HTML elements balanced and correctly nested."
      }
    ]
  },
  {
    "id": "html-form-02",
    "language": "html",
    "title": "Signup Form",
    "difficulty": "Medium",
    "timeLimitMs": 180000,
    "broken": "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>Runner Signup</title>\n</head>\n<body>\n  <main>\n    <h1>Join the Arena</h1>\n    <form action=\"/signup\" method=\"post\">\n      <label for=\"handle\">Handle</label>\n      <input id=\"handle\" name=\"handle\" type=\"text\" required>\n\n      <label for=\"email\">Email</label>\n      <input id=\"email\" name=\"email\" type=\"email\" required>\n\n      <label for=\"language\">Main language</label>\n      <select id=\"language\" name=\"mainLanguage\" required>\n        <option value=\"\">Choose one</option>\n        <option value=\"javascript\">JavaScript</option>\n        <option value=\"cpp\">C++</option>\n        <option value=\"csharp\">C#</option>\n      </select>\n\n      <label>\n        <input name=\"rules\" type=\"checkbox\" required>\n        I accept the arena rules.\n      </label>\n\n      <button type=\"submit\">Create Account</button>\n    </form>\n  </main>\n</body>\n</html>\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->",
    "solution": "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>Runner Signup</title>\n</head>\n<body>\n  <main>\n    <h1>Join the Arena</h1>\n    <form action=\"/signup\" method=\"post\">\n      <label for=\"handle\">Handle</label>\n      <input id=\"handle\" name=\"handle\" type=\"text\" required>\n\n      <label for=\"email\">Email</label>\n      <input id=\"email\" name=\"email\" type=\"email\" required>\n\n      <label for=\"language\">Main language</label>\n      <select id=\"language\" name=\"language\" required>\n        <option value=\"\">Choose one</option>\n        <option value=\"javascript\">JavaScript</option>\n        <option value=\"cpp\">C++</option>\n        <option value=\"csharp\">C#</option>\n      </select>\n\n      <label>\n        <input name=\"rules\" type=\"checkbox\" required>\n        I accept the arena rules.\n      </label>\n\n      <button type=\"submit\">Create Account</button>\n    </form>\n  </main>\n</body>\n</html>\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->\n<!-- arena filler -->",
    "bugs": [
      {
        "line": 21,
        "reason": "The select field uses a name that does not match the expected payload field.",
        "concept": "Form controls need stable name attributes because the name becomes the submitted key."
      }
    ]
  },
  {
    "id": "cpp-average-01",
    "language": "cpp",
    "title": "Average Temperature",
    "difficulty": "Easy",
    "timeLimitMs": 180000,
    "broken": "#include <iostream>\n#include <vector>\n#include <iomanip>\n#include <cmath>\n\nusing namespace std;\n\ndouble average(const vector<double>& values) {\n    double sum = 0.0;\n    for (double value : values) {\n        sum += value;\n    }\n    return sum / values.size();\n}\n\ndouble highest(const vector<double>& values) {\n    double best = values.front();\n    for (double value : values) {\n        if (value > best) {\n            best = value;\n        }\n    }\n    return best;\n}\n\nint main() {\n    vector<double> temps{21.5, 22.0, 19.5, 24.0, 23.0};\n    double result = average(temps);\n    double peak = highest(temps);\n\n    cout << fixed << setprecision(2);\n    cout << \"Average: \" << result << \"\\n\";\n    cout << \"Highest: \" << peak << \"\\n\";\n\n    const double expected = 22.00;\n    if (result == expected && peak == 24.00) {\n        cout << \"CHECK: PASS\\n\";\n    } else {\n        cout << \"CHECK: FAIL\\n\";\n    }\n\n    return 0;\n}\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler",
    "solution": "#include <iostream>\n#include <vector>\n#include <iomanip>\n#include <cmath>\n\nusing namespace std;\n\ndouble average(const vector<double>& values) {\n    double sum = 0.0;\n    for (double value : values) {\n        sum += value;\n    }\n    return sum / values.size();\n}\n\ndouble highest(const vector<double>& values) {\n    double best = values.front();\n    for (double value : values) {\n        if (value > best) {\n            best = value;\n        }\n    }\n    return best;\n}\n\nint main() {\n    vector<double> temps{21.5, 22.0, 19.5, 24.0, 23.0};\n    double result = average(temps);\n    double peak = highest(temps);\n\n    cout << fixed << setprecision(2);\n    cout << \"Average: \" << result << \"\\n\";\n    cout << \"Highest: \" << peak << \"\\n\";\n\n    const double expected = 22.00;\n    if (abs(result - expected) < 0.0001 && peak == 24.00) {\n        cout << \"CHECK: PASS\\n\";\n    } else {\n        cout << \"CHECK: FAIL\\n\";\n    }\n\n    return 0;\n}\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler",
    "bugs": [
      {
        "line": 34,
        "reason": "Exact floating-point equality can fail even when the mathematical values match.",
        "concept": "Compare floating-point values using an epsilon tolerance."
      }
    ]
  },
  {
    "id": "cpp-stack-02",
    "language": "cpp",
    "title": "Stack Underflow",
    "difficulty": "Medium",
    "timeLimitMs": 180000,
    "broken": "#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint popScore(vector<int>& stack) {\n    int value = stack.back();\n    stack.pop_back();\n    return value;\n}\n\nint safeScore(vector<int>& stack) {\n    if (stack.empty()) {\n        return 0;\n    }\n    return stack.back();\n}\n\nint main() {\n    vector<int> scores{10, 20};\n    int first = safeScore(scores);\n    int second = safeScore(scores);\n    int third = safeScore(scores);\n    int fourth = safeScore(scores);\n\n    cout << first << ' ' << second << ' ' << third << ' ' << fourth << \"\\n\";\n\n    if (first == 20 && second == 10 && third == 0 && fourth == 0) {\n        cout << \"CHECK: PASS\\n\";\n    } else {\n        cout << \"CHECK: FAIL\\n\";\n    }\n\n    return 0;\n}\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler",
    "solution": "#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint popScore(vector<int>& stack) {\n    int value = stack.back();\n    stack.pop_back();\n    return value;\n}\n\nint safeScore(vector<int>& stack) {\n    if (stack.empty()) {\n        return 0;\n    }\n    return popScore(stack);\n}\n\nint main() {\n    vector<int> scores{10, 20};\n    int first = safeScore(scores);\n    int second = safeScore(scores);\n    int third = safeScore(scores);\n    int fourth = safeScore(scores);\n\n    cout << first << ' ' << second << ' ' << third << ' ' << fourth << \"\\n\";\n\n    if (first == 20 && second == 10 && third == 0 && fourth == 0) {\n        cout << \"CHECK: PASS\\n\";\n    } else {\n        cout << \"CHECK: FAIL\\n\";\n    }\n\n    return 0;\n}\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler",
    "bugs": [
      {
        "line": 17,
        "reason": "The function reads the last score but never removes it, so repeated calls return the same value.",
        "concept": "A pop operation must read and remove the top element; mutate the stack after reading it."
      }
    ]
  },
  {
    "id": "csharp-grade-01",
    "language": "csharp",
    "title": "Grade Boundary",
    "difficulty": "Easy",
    "timeLimitMs": 180000,
    "broken": "using System;\nusing System.Collections.Generic;\n\nclass Program\n{\n    static string Grade(int score)\n    {\n        if (score >= 90)\n        {\n            return \"A\";\n        }\n        if (score >= 80)\n        {\n            return \"B\";\n        }\n        if (score >= 70)\n        {\n            return \"C\";\n        }\n        if (score >= 60)\n        {\n            return \"D\";\n        }\n        return \"F\";\n    }\n\n    static void Main()\n    {\n        var scores = new List<int> { 100, 90, 89, 80, 79, 70, 59 };\n        var expected = new[] { \"A\", \"A\", \"B\", \"B\", \"C\", \"C\", \"F\" };\n\n        for (int i = 0; i <= scores.Count; i++)\n        {\n            Console.WriteLine($\"{scores[i]} => {Grade(scores[i])}\");\n        }\n\n        bool pass = true;\n        for (int i = 0; i < expected.Length; i++)\n        {\n            pass &= Grade(scores[i]) == expected[i];\n        }\n\n        Console.WriteLine(pass ? \"CHECK: PASS\" : \"CHECK: FAIL\");\n    }\n}\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler",
    "solution": "using System;\nusing System.Collections.Generic;\n\nclass Program\n{\n    static string Grade(int score)\n    {\n        if (score >= 90)\n        {\n            return \"A\";\n        }\n        if (score >= 80)\n        {\n            return \"B\";\n        }\n        if (score >= 70)\n        {\n            return \"C\";\n        }\n        if (score >= 60)\n        {\n            return \"D\";\n        }\n        return \"F\";\n    }\n\n    static void Main()\n    {\n        var scores = new List<int> { 100, 90, 89, 80, 79, 70, 59 };\n        var expected = new[] { \"A\", \"A\", \"B\", \"B\", \"C\", \"C\", \"F\" };\n\n        for (int i = 0; i < scores.Count; i++)\n        {\n            Console.WriteLine($\"{scores[i]} => {Grade(scores[i])}\");\n        }\n\n        bool pass = true;\n        for (int i = 0; i < expected.Length; i++)\n        {\n            pass &= Grade(scores[i]) == expected[i];\n        }\n\n        Console.WriteLine(pass ? \"CHECK: PASS\" : \"CHECK: FAIL\");\n    }\n}\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler",
    "bugs": [
      {
        "line": 29,
        "reason": "The loop uses `<=`, so it accesses index `scores.Count`, which is outside the list.",
        "concept": "For zero-based collections, iterate while `i < Count`."
      }
    ]
  },
  {
    "id": "csharp-null-02",
    "language": "csharp",
    "title": "Null Safe Greeting",
    "difficulty": "Medium",
    "timeLimitMs": 180000,
    "broken": "using System;\n\nclass Program\n{\n    static string Greeting(string name)\n    {\n        string displayName = name.Trim();\n        if (displayName.Length == 0)\n        {\n            displayName = \"Runner\";\n        }\n        return $\"Hello, {displayName}!\";\n    }\n\n    static void Main()\n    {\n        string[] names = { \"Kai\", \"\", null, \"  Luna  \" };\n        string[] expected =\n        {\n            \"Hello, Kai!\",\n            \"Hello, Runner!\",\n            \"Hello, Runner!\",\n            \"Hello, Luna!\"\n        };\n\n        bool pass = true;\n        for (int i = 0; i < names.Length; i++)\n        {\n            string actual = Greeting(names[i]);\n            Console.WriteLine(actual);\n            pass &= actual == expected[i];\n        }\n\n        Console.WriteLine(pass ? \"CHECK: PASS\" : \"CHECK: FAIL\");\n    }\n}\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler",
    "solution": "using System;\n\nclass Program\n{\n    static string Greeting(string name)\n    {\n        string displayName = name?.Trim() ?? \"\";\n        if (displayName.Length == 0)\n        {\n            displayName = \"Runner\";\n        }\n        return $\"Hello, {displayName}!\";\n    }\n\n    static void Main()\n    {\n        string[] names = { \"Kai\", \"\", null, \"  Luna  \" };\n        string[] expected =\n        {\n            \"Hello, Kai!\",\n            \"Hello, Runner!\",\n            \"Hello, Runner!\",\n            \"Hello, Luna!\"\n        };\n\n        bool pass = true;\n        for (int i = 0; i < names.Length; i++)\n        {\n            string actual = Greeting(names[i]);\n            Console.WriteLine(actual);\n            pass &= actual == expected[i];\n        }\n\n        Console.WriteLine(pass ? \"CHECK: PASS\" : \"CHECK: FAIL\");\n    }\n}\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler\n// arena filler",
    "bugs": [
      {
        "line": 7,
        "reason": "`name` can be null, so calling `Trim()` immediately can throw a NullReferenceException.",
        "concept": "Use null-safe access or check for null before calling instance methods."
      }
    ]
  },
{
  "id": "js-cart-average-03",
  "language": "javascript",
  "title": "Cart Average",
  "difficulty": "Easy",
  "timeLimitMs": 165000,
  "broken": "const prices = [12, 18, 25, 31, 44];\n\nfunction average(values) {\n  let sum = 0;\n  for (const value of values) sum += value;\n  return sum / (values.length - 1);\n}\n\nconst result = average(prices);\nconsole.log('AVERAGE:', result.toFixed(2));\nif (Math.abs(result - 26) < 0.001) console.log('CHECK: PASS');\nelse console.log('CHECK: FAIL');",
  "solution": "const prices = [12, 18, 25, 31, 44];\n\nfunction average(values) {\n  let sum = 0;\n  for (const value of values) sum += value;\n  return sum / values.length;\n}\n\nconst result = average(prices);\nconsole.log('AVERAGE:', result.toFixed(2));\nif (Math.abs(result - 26) < 0.001) console.log('CHECK: PASS');\nelse console.log('CHECK: FAIL');",
  "bugs": [
    {
      "line": 6,
      "reason": "Phép chia dùng length - 1 làm sai mẫu số của trung bình cộng.",
      "concept": "Trung bình cộng phải chia cho đúng số phần tử."
    }
  ],
  "description": "Sửa phép tính trung bình của một danh sách giá."
},
{
  "id": "js-titlecase-04",
  "language": "javascript",
  "title": "Titlecase Filter",
  "difficulty": "Medium",
  "timeLimitMs": 165000,
  "broken": "const names = ['luna', 'neo', 'rIN', '  hk  '];\n\nfunction normalizeName(name) {\n  const cleaned = name.trim();\n  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1).toLowerCase();\n}\n\nconst result = names.map(normalizeName);\nconsole.log(result.join('|'));\nif (result.join('|') === 'Luna|Neo|Rin|Hk') console.log('CHECK: PASS');\nelse console.log('CHECK: FAIL');",
  "solution": "const names = ['luna', 'neo', 'rIN', '  hk  '];\n\nfunction normalizeName(name) {\n  const cleaned = name.trim();\n  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();\n}\n\nconst result = names.map(normalizeName);\nconsole.log(result.join('|'));\nif (result.join('|') === 'Luna|Neo|Rin|Hk') console.log('CHECK: PASS');\nelse console.log('CHECK: FAIL');",
  "bugs": [
    {
      "line": 6,
      "reason": "Ký tự đầu tiên bị chuyển thành lowercase nên tên không được chuẩn hóa Title Case.",
      "concept": "Title Case cần uppercase ký tự đầu và lowercase phần còn lại."
    }
  ],
  "description": "Chuẩn hóa tên hiển thị thành Title Case."
},
{
  "id": "html-table-03",
  "language": "html",
  "title": "Score Table",
  "difficulty": "Easy",
  "timeLimitMs": 150000,
  "broken": "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><title>Scores</title></head>\n<body>\n<table>\n  <caption>Speedrun Scores</caption>\n  <thead><tr><th>Runner</th><th>Score</th></tr></thead>\n  <tbody>\n    <tr><td>Rin</td><td>980</td></tr>\n    <tr><td>Kai</td><td>920</td></tr>\n  </tbody>\n</table>\n</body></html>",
  "solution": "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><title>Scores</title></head>\n<body>\n<table>\n  <caption>Speedrun Scores</caption>\n  <thead><tr><th scope=\"col\">Runner</th><th scope=\"col\">Score</th></tr></thead>\n  <tbody>\n    <tr><td>Rin</td><td>980</td></tr>\n    <tr><td>Kai</td><td>920</td></tr>\n  </tbody>\n</table>\n</body></html>",
  "bugs": [
    {
      "line": 6,
      "reason": "Table headers thiếu scope=col nên không mô tả rõ cột cho trình đọc màn hình.",
      "concept": "Header cell của cột nên khai báo scope=col."
    }
  ],
  "description": "Sửa semantic accessibility cho bảng điểm."
},
{
  "id": "html-navigation-04",
  "language": "html",
  "title": "Navigation Landmark",
  "difficulty": "Medium",
  "timeLimitMs": 150000,
  "broken": "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><title>Arena</title></head>\n<body>\n<div class=\"site-nav\">\n  <a href=\"#home\">Home</a>\n  <a href=\"#runs\">Runs</a>\n  <a href=\"#rank\">Rank</a>\n</div>\n<main id=\"home\"><h1>Bug Speedrunner</h1></main>\n</body></html>",
  "solution": "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><title>Arena</title></head>\n<body>\n<nav aria-label=\"Primary\">\n  <a href=\"#home\">Home</a>\n  <a href=\"#runs\">Runs</a>\n  <a href=\"#rank\">Rank</a>\n</nav>\n<main id=\"home\"><h1>Bug Speedrunner</h1></main>\n</body></html>",
  "bugs": [
    {
      "line": 5,
      "reason": "Thanh điều hướng đang dùng div thay vì landmark nav có nhãn truy cập.",
      "concept": "Dùng phần tử nav cho nhóm liên kết điều hướng chính."
    }
  ],
  "description": "Biến thanh điều hướng thành semantic landmark."
},
{
  "id": "cpp-even-sum-03",
  "language": "cpp",
  "title": "Even Sum",
  "difficulty": "Easy",
  "timeLimitMs": 165000,
  "broken": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    vector<int> values{4, 7, 10, 13, 16, 21};\n    int sum = 0;\n    for (int value : values) {\n        if (value % 2 != 0) sum += value;\n    }\n    cout << sum << \"\\n\";\n    cout << (sum == 30 ? \"CHECK: PASS\\n\" : \"CHECK: FAIL\\n\");\n}",
  "solution": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    vector<int> values{4, 7, 10, 13, 16, 21};\n    int sum = 0;\n    for (int value : values) {\n        if (value % 2 == 0) sum += value;\n    }\n    cout << sum << \"\\n\";\n    cout << (sum == 30 ? \"CHECK: PASS\\n\" : \"CHECK: FAIL\\n\");\n}",
  "bugs": [
    {
      "line": 9,
      "reason": "Điều kiện đang chọn số lẻ thay vì số chẵn.",
      "concept": "Số chẵn có phần dư 0 khi chia cho 2."
    }
  ],
  "description": "Tính tổng các số chẵn trong vector."
},
{
  "id": "cpp-palindrome-04",
  "language": "cpp",
  "title": "Palindrome Check",
  "difficulty": "Medium",
  "timeLimitMs": 175000,
  "broken": "#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string text = \"level\";\n    bool ok = true;\n    for (size_t i = 0; i < text.size() / 2; ++i) {\n        if (text[i] == text[text.size() - 1 - i]) {\n            ok = false;\n            break;\n        }\n    }\n    cout << (ok ? \"CHECK: PASS\\n\" : \"CHECK: FAIL\\n\");\n}",
  "solution": "#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string text = \"level\";\n    bool ok = true;\n    for (size_t i = 0; i < text.size() / 2; ++i) {\n        if (text[i] != text[text.size() - 1 - i]) {\n            ok = false;\n            break;\n        }\n    }\n    cout << (ok ? \"CHECK: PASS\\n\" : \"CHECK: FAIL\\n\");\n}",
  "bugs": [
    {
      "line": 9,
      "reason": "Điều kiện đánh dấu fail khi hai ký tự trùng nhau thay vì khi chúng khác nhau.",
      "concept": "Palindrome chỉ sai khi một cặp đối xứng khác nhau."
    }
  ],
  "description": "Kiểm tra chuỗi palindrome bằng hai đầu."
},
{
  "id": "csharp-invoice-03",
  "language": "csharp",
  "title": "Invoice Total",
  "difficulty": "Easy",
  "timeLimitMs": 165000,
  "broken": "using System;\n\nclass Program\n{\n    static decimal Total(decimal price, int quantity, decimal tax)\n    {\n        decimal subtotal = price * quantity;\n        return subtotal - subtotal * tax;\n    }\n\n    static void Main()\n    {\n        decimal total = Total(40m, 3, 0.10m);\n        Console.WriteLine(total);\n        Console.WriteLine(total == 132m ? \"CHECK: PASS\" : \"CHECK: FAIL\");\n    }\n}",
  "solution": "using System;\n\nclass Program\n{\n    static decimal Total(decimal price, int quantity, decimal tax)\n    {\n        decimal subtotal = price * quantity;\n        return subtotal + subtotal * tax;\n    }\n\n    static void Main()\n    {\n        decimal total = Total(40m, 3, 0.10m);\n        Console.WriteLine(total);\n        Console.WriteLine(total == 132m ? \"CHECK: PASS\" : \"CHECK: FAIL\");\n    }\n}",
  "bugs": [
    {
      "line": 7,
      "reason": "Thuế đang bị trừ khỏi subtotal thay vì cộng vào hóa đơn.",
      "concept": "Tổng sau thuế phải bằng subtotal + tax amount."
    }
  ],
  "description": "Tính tổng hóa đơn gồm thuế."
},
{
  "id": "csharp-temperature-04",
  "language": "csharp",
  "title": "Temperature Convert",
  "difficulty": "Medium",
  "timeLimitMs": 165000,
  "broken": "using System;\n\nclass Program\n{\n    static double ToCelsius(double fahrenheit)\n    {\n        return (fahrenheit * 9.0 / 5.0) + 32.0;\n    }\n\n    static void Main()\n    {\n        double result = ToCelsius(68);\n        Console.WriteLine(result.ToString(\"0.00\"));\n        Console.WriteLine(Math.Abs(result - 20.0) < 0.001 ? \"CHECK: PASS\" : \"CHECK: FAIL\");\n    }\n}",
  "solution": "using System;\n\nclass Program\n{\n    static double ToCelsius(double fahrenheit)\n    {\n        return (fahrenheit - 32.0) * 5.0 / 9.0;\n    }\n\n    static void Main()\n    {\n        double result = ToCelsius(68);\n        Console.WriteLine(result.ToString(\"0.00\"));\n        Console.WriteLine(Math.Abs(result - 20.0) < 0.001 ? \"CHECK: PASS\" : \"CHECK: FAIL\");\n    }\n}",
  "bugs": [
    {
      "line": 6,
      "reason": "Công thức đang thực hiện chiều ngược lại và cộng 32 thay vì trừ 32 rồi nhân 5/9.",
      "concept": "Celsius = (Fahrenheit - 32) × 5/9."
    }
  ],
  "description": "Chuyển đổi Fahrenheit sang Celsius đúng công thức."
}
];

