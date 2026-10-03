import type { AuthStore, OAuthTransaction, StoredSession } from '@livingforma/auth';
import type { Store } from '@livingforma/db';
import type { User } from '@livingforma/contracts';
export function createAuthStore(store:Store,options:{onSessionDeleted?:(session:StoredSession)=>void}={}):AuthStore{return {
  async resolveIdentity(identity){
    if(identity.provider==='local'){
      if(!['owner','participant'].includes(identity.subject))throw new Error('Unknown local persona');
      return store.putUser({id:`user-local-${identity.subject}`,name:identity.name});
    }
    return store.upsertGoogleUser({sub:identity.subject,name:identity.name,email:identity.email,picture:identity.avatarUrl});
  },
  async createSession(session){await store.db.query('DELETE FROM lf_sessions WHERE expires_at<=now()');await store.db.query('INSERT INTO lf_sessions(token_hash,user_id,data,expires_at) VALUES($1,$2,$3,$4)',[session.tokenHash,session.userId,JSON.stringify(session),session.expiresAt]);},
  async getSession(hash){const row=(await store.db.query<{data:StoredSession;profile:User}>('SELECT s.data,u.profile FROM lf_sessions s JOIN lf_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash])).rows[0];return row?{...row.data,user:row.profile}:null;},
  async deleteSession(hash){const removed=await store.db.query<{data:StoredSession}>('DELETE FROM lf_sessions WHERE token_hash=$1 RETURNING data',[hash]);if(removed.rows[0])options.onSessionDeleted?.(removed.rows[0].data);},
  async saveOAuthTransaction(transaction){await store.db.query('DELETE FROM lf_oauth_transactions WHERE expires_at<=now()');await store.db.query('INSERT INTO lf_oauth_transactions(state_hash,data,expires_at) VALUES($1,$2,$3)',[transaction.stateHash,JSON.stringify(transaction),transaction.expiresAt]);},
  async consumeOAuthTransaction(hash){return (await store.db.query<{data:OAuthTransaction}>('DELETE FROM lf_oauth_transactions WHERE state_hash=$1 RETURNING data',[hash])).rows[0]?.data??null;},
};}
