import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";

export default function CreditBalance() {
  const { data: creditData, isLoading } = useQuery<{ credits: number }>({
    queryKey: ["/api/credits"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="bg-dark-600 rounded-lg px-4 py-2 border border-dark-500" data-testid="credit-balance">
      <div className="flex items-center space-x-2">
        <Coins className="w-5 h-5 text-yellow-400" />
        <span className="text-sm font-medium" data-testid="text-credits">
          {isLoading ? "..." : creditData?.credits || 0}
        </span>
        <span className="text-xs text-gray-400">credits</span>
      </div>
    </div>
  );
}
