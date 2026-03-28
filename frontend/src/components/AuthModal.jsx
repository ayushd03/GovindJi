import React from 'react';
import AuthFlow from './auth/AuthFlow';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

const AuthModal = ({ isOpen, onClose, initialMode = 'sign-in', nextPath = '' }) => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-0 p-0 sm:rounded-3xl">
      <div className="sr-only">
        <DialogTitle>Account access</DialogTitle>
        <DialogDescription>Sign in, create an account, or recover your password.</DialogDescription>
      </div>
      <div className="bg-background p-4 sm:p-6">
        <AuthFlow
          variant="dialog"
          mode={initialMode}
          nextPath={nextPath}
          onRequestClose={onClose}
        />
      </div>
    </DialogContent>
  </Dialog>
);

export default AuthModal;
