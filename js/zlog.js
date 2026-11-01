// Журнал «История заказа»: кто, время, действие, подробности.
import * as S from './store.js?v=52';
export function logEvent(d, action, detail = '') {
  d.log = d.log || [];
  d.log.push({ at: new Date().toISOString(), who: S.me().id, action, detail });
  S.save();
}
