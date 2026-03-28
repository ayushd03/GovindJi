import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '../lib/utils';

const sizeClasses = {
  sm: 'admin-dialog-panel-sm',
  md: 'admin-dialog-panel-md',
  lg: 'admin-dialog-panel-lg',
  xl: 'admin-dialog-panel-xl',
  full: 'admin-dialog-panel-full',
};

const AdminDialog = DialogPrimitive.Root;
const AdminDialogTrigger = DialogPrimitive.Trigger;
const AdminDialogClose = DialogPrimitive.Close;

const AdminDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('admin-dialog-overlay', className)}
    {...props}
  />
));

AdminDialogOverlay.displayName = 'AdminDialogOverlay';

const AdminDialogContent = React.forwardRef(
  ({ className, children, size = 'lg', ...props }, ref) => (
    <DialogPrimitive.Portal>
      <AdminDialogOverlay />
      <div className="admin-dialog-shell">
        <div className="admin-dialog-center">
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              'admin-dialog-panel',
              sizeClasses[size] || sizeClasses.lg,
              className
            )}
            {...props}
          >
            {children}
          </DialogPrimitive.Content>
        </div>
      </div>
    </DialogPrimitive.Portal>
  )
);

AdminDialogContent.displayName = 'AdminDialogContent';

const AdminDialogHeader = ({ className, sticky = false, ...props }) => (
  <div
    className={cn(
      'admin-dialog-header',
      sticky && 'admin-dialog-header-sticky',
      className
    )}
    {...props}
  />
);

const AdminDialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('admin-dialog-title', className)}
    {...props}
  />
));

AdminDialogTitle.displayName = 'AdminDialogTitle';

const AdminDialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('admin-dialog-description', className)}
    {...props}
  />
));

AdminDialogDescription.displayName = 'AdminDialogDescription';

const AdminDialogBody = ({ className, ...props }) => (
  <div className={cn('admin-dialog-body', className)} {...props} />
);

const AdminDialogFooter = ({ className, sticky = false, ...props }) => (
  <div
    className={cn(
      'admin-dialog-footer',
      sticky && 'admin-dialog-footer-sticky',
      className
    )}
    {...props}
  />
);

const AdminDialogIconButton = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Close
    ref={ref}
    className={cn('admin-dialog-close', className)}
    {...props}
  >
    {children || <XMarkIcon className="h-5 w-5" />}
    <span className="sr-only">Close</span>
  </DialogPrimitive.Close>
));

AdminDialogIconButton.displayName = 'AdminDialogIconButton';

export {
  AdminDialog,
  AdminDialogTrigger,
  AdminDialogClose,
  AdminDialogOverlay,
  AdminDialogContent,
  AdminDialogHeader,
  AdminDialogTitle,
  AdminDialogDescription,
  AdminDialogBody,
  AdminDialogFooter,
  AdminDialogIconButton,
};
