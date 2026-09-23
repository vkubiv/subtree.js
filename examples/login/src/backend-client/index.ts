/**
 * The contract of the backend-client. In a real app this is a separate package
 * (transport, API groups, models, role facades); here only the API groups the
 * app needs, with the same rules: stateless, explicit `ApiContext`, expected
 * failures as `Result` errors, unexpected ones thrown.
 */
import type { AsyncResult } from "operation-result.js";
import { type ApiNotAuthorized, AppError } from "trunk.js";

/** What every authenticated call carries. Issued by `LoggedinUser.authorizeCall()`. */
export interface ApiContext {
  readonly token: string;
}

export interface LoginResponse {
  readonly token: string;
  readonly userId: string;
}

export interface UserProfile {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

export class InvalidCredentials extends AppError {
  constructor() {
    super("Login or password is incorrect");
  }
}

export interface AuthApi {
  login(username: string, password: string): AsyncResult<LoginResponse, InvalidCredentials>;
}

export interface UserApi {
  me(ctx: ApiContext): AsyncResult<UserProfile, ApiNotAuthorized>;
}

export interface BackendClient {
  readonly auth: AuthApi;
  readonly user: UserApi;
}
