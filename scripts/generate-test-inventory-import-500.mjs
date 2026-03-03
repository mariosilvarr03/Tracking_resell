import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve(process.cwd(), "scripts", "test-inventory-import-500.csv");
const totalRows = 500;

const header =
  "title;type;buy_price;buy_date;quantity;size;brand;condition;size_eu;model;event_name;event_date;location;seat_info;game;set_name;card_name;grade;language;extra";

const lines = [header];

for (let i = 1; i <= totalRows; i += 1) {
  const padded = String(i).padStart(4, "0");
  const day = String((i % 28) + 1).padStart(2, "0");

  if (i % 5 === 1) {
    lines.push(
      `Load Tee ${padded};ROUPA;${(20 + (i % 12)).toFixed(2)};2026-02-${day};1;M;Nike;Usado;;;;;;;;;;;`
    );
  } else if (i % 5 === 2) {
    lines.push(
      `Load Sneaker ${padded};SAPATILHAS;${(80 + (i % 90)).toFixed(2)};2026-02-${day};1;;;Novo;42;Model ${padded};;;;;;;;;`
    );
  } else if (i % 5 === 3) {
    lines.push(
      `Load Ticket ${padded};BILHETES;${(35 + (i % 60)).toFixed(2)};2026-02-${day};2;;;;;;Evento ${padded};2026-03-${day};Lisboa;A${(i % 30) + 1};;;;;;`
    );
  } else if (i % 5 === 4) {
    lines.push(
      `Load Card ${padded};CARTAS;${(15 + (i % 45)).toFixed(2)};2026-02-${day};1;;;;;;;;;;;Pokemon;Base Set;Card ${padded};;EN;`
    );
  } else {
    lines.push(
      `Load Random ${padded};RANDOM;${(10 + (i % 30)).toFixed(2)};2026-02-${day};1;;;;;;;;;;;;;;;;;"{""batch"":""beta"",""sku"":""R${padded}""}"`
    );
  }
}

writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Created ${totalRows} rows at ${outputPath}`);
