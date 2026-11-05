import { auth } from '../config/firebase';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async getAuthHeaders() {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // New method for public API calls that don't require authentication
  async getPublicHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  // Modified get method to support optional authentication
  async get(endpoint, requireAuth = true) {
    let headers;
    
    if (requireAuth) {
      headers = await this.getAuthHeaders();
    } else {
      headers = await this.getPublicHeaders();
    }
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  async post(endpoint, data, requireAuth = true) {
    const headers = requireAuth ? await this.getAuthHeaders() : await this.getPublicHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      // Try to parse error response as JSON
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch {
        // If JSON parsing fails, throw generic error
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    return response.json();
  }

  async put(endpoint, data) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      // Try to parse error response as JSON
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch {
        // If JSON parsing fails, throw generic error
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    return response.json();
  }

  async patch(endpoint, data) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    return response.json();
  }

  async delete(endpoint) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers
    });
    
    if (!response.ok) {
      // Try to get error text for failed requests
      let errorMessage;
      try {
        const errorText = await response.text();
        // Try to parse as JSON first
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        } catch {
          // If not JSON, use the text as is
          errorMessage = errorText || `HTTP error! status: ${response.status}`;
        }
      } catch {
        errorMessage = `HTTP error! status: ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    
    // For successful responses, try to parse as JSON first, fallback to text
    const responseText = await response.text();
    if (!responseText) {
      return null; // Empty response
    }
    
    try {
      return JSON.parse(responseText);
    } catch {
      // If JSON parsing fails, return the text response
      return responseText;
    }
  }

  // For multipart form data (file uploads)
  async postMultipart(endpoint, formData) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type for FormData, browser will set it with boundary
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  // For multipart form data (file uploads) with PUT method
  async putMultipart(endpoint, formData) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type for FormData, browser will set it with boundary
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
}

const apiServiceInstance = new ApiService();
export { apiServiceInstance as ApiService }; 