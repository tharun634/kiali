import * as React from 'react';
import { Dropdown, DropdownItem, DropdownToggle } from '@patternfly/react-core';
import { SessionTimeout } from '../../SessionTimeout/SessionTimeout';
import { config } from '../../../config';
import { MILLISECONDS } from '../../../types/Common';
import { Timer } from 'globals';
import { KialiAppState, LoginSession } from '../../../store/Store';
import authenticationConfig from '../../../config/AuthenticationConfig';
import { AuthStrategy } from '../../../types/Auth';
import moment from 'moment';
import { KialiDispatch } from 'types/Redux';
import LoginThunkActions from '../../../actions/LoginThunkActions';
import { connect } from 'react-redux';
import * as API from '../../../services/Api';

type UserProps = {
  session?: LoginSession;
  logout: () => void;
  extendSession: (session: LoginSession) => void;
};

type UserState = {
  showSessionTimeOut: boolean;
  timeCountDownSeconds: number;
  checkSessionTimerId?: Timer;
  timeLeftTimerId?: Timer;
  isDropdownOpen: boolean;
  isSessionTimeoutDismissed: boolean;
};

class UserDropdownConnected extends React.Component<UserProps, UserState> {
  constructor(props: UserProps) {
    super(props);
    this.state = {
      showSessionTimeOut: false,
      timeCountDownSeconds: this.timeLeft() / MILLISECONDS,
      isSessionTimeoutDismissed: false,
      isDropdownOpen: false
    };
  }
  componentDidMount() {
    const checkSessionTimerId = setInterval(() => {
      this.checkSession();
    }, 3000);
    const timeLeftTimerId = setInterval(() => {
      this.setState({ timeCountDownSeconds: this.timeLeft() / MILLISECONDS });
    }, 1000);

    this.setState({
      checkSessionTimerId: checkSessionTimerId,
      timeLeftTimerId: timeLeftTimerId
    });
  }

  componentWillUnmount() {
    if (this.state.checkSessionTimerId) {
      clearInterval(this.state.checkSessionTimerId);
    }
    if (this.state.timeLeftTimerId) {
      clearInterval(this.state.timeLeftTimerId);
    }
  }

  timeLeft = (): number => {
    const expiresOn = moment(this.props.session!.expiresOn);

    if (expiresOn <= moment()) {
      this.props.logout();
    }

    return expiresOn.diff(moment());
  };

  checkSession = () => {
    if (this.timeLeft() < config.session.timeOutforWarningUser) {
      this.setState({ showSessionTimeOut: true });
    }
  };

  handleLogout = () => {
    if (authenticationConfig.logoutEndpoint) {
      API.logout()
        .then(_ => {
          (document.getElementById('openshiftlogout') as HTMLFormElement).submit();
        })
        .catch(error => {
          const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
          console.error(`Logout failed. "kiali-token" cookie may need to be cleared manually: ${errorMsg}`);
          (document.getElementById('openshiftlogout') as HTMLFormElement).submit();
        });
    } else {
      this.props.logout();
    }
  };

  extendSession = (session: LoginSession) => {
    this.props.extendSession(session);
    this.setState({ showSessionTimeOut: false });
  };

  onDropdownToggle = isDropdownOpen => {
    this.setState({
      isDropdownOpen
    });
  };

  onDropdownSelect = _event => {
    this.setState({
      isDropdownOpen: !this.state.isDropdownOpen
    });
  };

  render() {
    const { isDropdownOpen } = this.state;
    const canLogout =
      authenticationConfig.strategy !== AuthStrategy.anonymous && authenticationConfig.strategy !== AuthStrategy.header;

    const userDropdownItems = (
      <DropdownItem key={'user_logout_option'} onClick={this.handleLogout} isDisabled={!canLogout}>
        Logout
      </DropdownItem>
    );
    return (
      <>
        <SessionTimeout
          onLogout={this.props.logout}
          onExtendSession={this.extendSession}
          onDismiss={this.dismissHandler}
          show={this.state.showSessionTimeOut && !this.state.isSessionTimeoutDismissed}
          timeOutCountDown={this.state.timeCountDownSeconds}
        />
        {this.props.session && !canLogout && <>{this.props.session.username}</>}
        {this.props.session && canLogout && (
          <Dropdown
            isPlain={true}
            position="right"
            onSelect={this.onDropdownSelect}
            isOpen={isDropdownOpen}
            toggle={
              <DropdownToggle id={'user-dropdown-toggle'} onToggle={this.onDropdownToggle}>
                {this.props.session.username}
              </DropdownToggle>
            }
            dropdownItems={[userDropdownItems]}
          />
        )}
        {authenticationConfig.strategy === AuthStrategy.openshift && authenticationConfig.logoutEndpoint && (
          <form id="openshiftlogout" action={authenticationConfig.logoutEndpoint} method="post">
            <input type="hidden" name="then" value={authenticationConfig.logoutRedirect} />
          </form>
        )}
      </>
    );
  }

  private dismissHandler = () => {
    this.setState({ isSessionTimeoutDismissed: true });
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  session: state.authentication.session
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  logout: () => dispatch(LoginThunkActions.logout()),
  extendSession: (session: LoginSession) => dispatch(LoginThunkActions.extendSession(session))
});

const UserDropdown = connect(mapStateToProps, mapDispatchToProps)(UserDropdownConnected);

export default UserDropdown;
