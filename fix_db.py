
import os
import re

filepath = r'd:\JOE-Cafeteria-Automation-mobile\services\firestore-db.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the broken callback structure in listenToPendingItems
# Lines 1401-1407
fixed_listen_block = """            });
          });
          callback(pendingItems);
        },
        (error) => {
          console.error("Error listening to pending items:", error);
          callback([]);
        }
      );
    };"""

text, count1 = re.subn(r'\}\s+;\s+\(error\) => \{\s+console\.error\(.*?\);\s+callback\(\[\]\);\s+\}\s+\);\s+\};', fixed_listen_block, text, flags=re.DOTALL)
text, count2 = re.subn(r'\}\s+\);\s+\(error\) => \{\s+console\.error\(.*?\);\s+callback\(\[\]\);\s+\}\s+\);\s+\};', fixed_listen_block, text, flags=re.DOTALL)
# Try the exact string seen in view_file
exact_broken = '            });     (error) => {\n       console.error("Error listening to pending items:", error);\n       callback([]);\n     }\n   );\n};'
if exact_broken in text:
    text = text.replace(exact_broken, fixed_listen_block)
    print("✅ Fixed literal listen block.")

# Fix the debris at line 1505-1511
text, count3 = re.subn(r';\s+};\s+any\) \{\s+console\.error\(\'.*?\[SCAN-ERROR\]:\', error\.message\);\s+throw error;\s+\}\s+};', '      });\n   } catch (error: any) {\n      console.error(\'❌ [ATOMIC-INTAKE-ERROR]:\', error.message);\n      throw error;\n   }\n};', text, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print(f"🚀 Logic Fix results: {max(count1, count2)} listen fixes, {count3} intake fixes.")
