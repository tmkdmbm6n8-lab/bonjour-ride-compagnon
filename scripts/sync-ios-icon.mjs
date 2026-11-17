import {copyFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(resolve(root, 'ios/App/App'))) {
  console.error('Ajoutez d’abord iOS : npx cap add ios');
  process.exit(1);
}
const assets = resolve(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
mkdirSync(assets, {recursive: true});
copyFileSync(resolve(root, 'public/app-icon.png'), resolve(assets, 'AppIcon-1024.png'));
writeFileSync(resolve(assets, 'Contents.json'), JSON.stringify({
  images: [{filename: 'AppIcon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024'}],
  info: {author: 'xcode', version: 1},
}, null, 2) + '\n');
console.log('Icône StrasDrive installée. Relancez l’application dans Xcode (⌘ + R).');
