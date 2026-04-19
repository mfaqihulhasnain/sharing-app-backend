// Purpose: standardize successful API responses across controllers and routes.
class ApiResponse {
  constructor(message, data) {
    this.success = true;
    this.message = message;
    if (data !== undefined) this.data = data;
  }
}

export default ApiResponse;
