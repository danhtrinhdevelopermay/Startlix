import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export interface AuthUser {
  id: string;
  username: string;
  credits: number;
}

export interface AuthResponse {
  user: AuthUser;
}

export function useAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user: data as AuthUser | undefined,
    isLoading,
    isAuthenticated: !!data,
    error
  };
}

export function useLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }): Promise<AuthResponse> => {
      const response = await fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Đăng nhập thất bại');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Set auth data immediately to update isAuthenticated state
      queryClient.setQueryData(["/api/auth/user"], data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
    }
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userData: { username: string; password: string; deviceId?: string }): Promise<AuthResponse> => {
      const response = await fetch('/api/register', {
        method: 'POST',
        body: JSON.stringify(userData),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Đăng ký thất bại');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
    }
  });
}

export function useCheckDevice() {
  return useMutation({
    mutationFn: async (data: { deviceId: string }): Promise<{ canRegister: boolean; reason?: string }> => {
      const response = await fetch('/api/check-device', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.reason || 'Không thể kiểm tra thiết bị');
      }
      
      return response.json();
    }
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/logout', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Đăng xuất thất bại');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Clear all authentication-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      queryClient.removeQueries({ queryKey: ["/api/generations"] });
      
      // Clear user data immediately to prevent flash of content
      queryClient.setQueryData(["/api/auth/user"], null);
      
      // Navigate to login page immediately
      setTimeout(() => {
        setLocation("/login");
      }, 100);
    }
  });
}