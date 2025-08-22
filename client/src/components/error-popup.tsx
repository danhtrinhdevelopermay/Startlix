import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WarningRegular, DismissRegular } from "@fluentui/react-icons";

interface ErrorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  type?: "error" | "warning" | "info";
}

export default function ErrorPopup({ isOpen, onClose, title, description, type = "error" }: ErrorPopupProps) {
  const getIcon = () => {
    switch (type) {
      case "error":
        return <WarningRegular className="w-6 h-6 text-red-500" />;
      case "warning":
        return <WarningRegular className="w-6 h-6 text-yellow-500" />;
      case "info":
        return <WarningRegular className="w-6 h-6 text-blue-500" />;
      default:
        return <WarningRegular className="w-6 h-6 text-red-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] max-w-md shadow-lg">
        <DialogHeader className="pb-4">
          <div className="flex items-center space-x-3">
            {getIcon()}
            <DialogTitle className="text-lg font-semibold">
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <DialogDescription className="text-gray-300 text-sm leading-6 mb-6">
          {description}
        </DialogDescription>
        
        <div className="flex justify-end space-x-3">
          <Button
            onClick={onClose}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6"
            data-testid="button-close-popup"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}