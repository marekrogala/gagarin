describe('Closures', function () {

  var server = meteor();

  var a = Math.random();
  var b = Math.random();
  var c = Math.random();
  var d = Math.random();

  var zero  = 0;
  
  var v_undefined = undefined;
  var v_null      = null;

  closure(['a', 'b', 'c', 'd', 'zero', 'v_undefined', 'v_null'], function (expr) { return eval(expr); });

  describe('Closure variables in server scripts', function () {

    describe('Value persitance', function () {

      it('zero value should not be interpreted as undefined', function () {
        return server.execute(function () {
          return zero;
        }).then(function (value) {
          expect(value).to.equal(0);
        });
      });

      it('null variable should equal null', function () {
        return server.execute(function () {
          return v_null;
        }).then(function (value) {
          expect(value).to.equal(null);
        });
      });

      it('undefined variable should be translated to null variable', function () {
        return server.execute(function () {
          return v_undefined;
        }).then(function (value) {
          expect(value).to.equal(null);
        });
      });

    });

    describe('When using server.execute', function () {

      beforeEach(function () {
        b = Math.random().toString();
      });

      it('should be able to access a closure variable', function () {
        return server.execute(function () {
          return a;
        }).then(function (value) {
          expect(value).to.equal(a);
        });
      });

      it('should be able to alter a closure variable', function () {
        return server.execute(function () {
          return a = Math.random();
        }).then(function (value) {
          expect(a).to.equal(value);
        });
      });

      it('even if the code throws', function () {
        return server.execute(function () {
          a = b;
          throw new Error('another fake error')
        }).expectError(function (err) {
          expect(err.message).to.contain('another fake err');
        }).then(function (value) {
          expect(a).to.equal(b);
        });
      });

      it.skip('should be able to update closure with sync routine', function () {
        return server.execute(function () {
          var value = Math.random();
          $sync({ a: value });
          return value;
        }).then(function (value) {
          expect(a).to.equal(value);
        });
      });

      it.skip('should be able to update closure asynchronously with sync routine', function () {
        return server.execute(function () {
          var value = Math.random();
          Meteor.setTimeout(function () {
            $sync({ a: value });
          });
          return value;
        }).then(function (value) {
          return wait(1000, 'until value is updated', function () {
            return a === value;
          });
        });
      });

    });

    describe('When using server.promise', function () {

      beforeEach(function () {
        b = 10;
        c = Math.random().toString();
      });

      it('should be able to access a closure variable', function () {
        return server.promise(function (resolve) {
          setTimeout(function () {
            resolve(b);
          }, 100);
        }).then(function (value) {
          expect(value).to.equal(b);
        });
      });

      it('should be able to alter a closure variable', function () {
        return server.promise(function (resolve) {
          setTimeout(function () {
            resolve(b = Math.random());
          }, 100);
        }).then(function (value) {
          expect(value).to.equal(b);
        });
      });

      it('even if the promise is rejected', function () {
        return server.promise(function (resolve, reject) {
          setTimeout(function () {
            reject(b = Math.random().toString());
          }, 100);
        }).catch(function (err) {
          expect(err.toString()).to.contain(b);
        });
      });

      it('and if the promise code throws', function () {
        return server.promise(function () {
          a = c;
          throw new Error('another fake error')
        }).expectError(function (err) {
          expect(err.message).to.contain('another fake err');
        }).then(function (value) {
          expect(a).to.equal(c);
        });
      });

      it('should be able to alter a closure variable right after calling "resolve"', function () {
        return server.promise(function (resolve) {
          setTimeout(function () {
            var value = Math.random();
            resolve(value);
            b = value;
          }, 100);
        }).then(function (value) {
          expect(value).to.equal(b);
        });
      });

      it.skip('should be able to use sync with promises', function () {
        var handle = setInterval(function () { b -= 1 }, 10);
        return server.promise(function (resolve, reject) {
          var handle2 = Meteor.setInterval(function () {
            if ($sync().b < 0) {
              Meteor.clearInterval(handle2);
              resolve(b);
            }
          }, 10);
        }).then(function (value) {
          expect(b).to.equal(value);
        }).always(function () {
          clearInterval(handle);
        });
      });

    });

    describe('When using server.wait', function () {

      beforeEach(function () {
        a = 10;
        b = 10;
        c = 10;
        d = 10;
      });

      it('should be able to access a closure variable', function () {
        return server.wait(1000, 'until c equals 10', function () {
          return c === 10;
        });
      });

      it('should be able to alter a closure variable', function () {
        return server.wait(1000, 'until c is negative', function () {
          return (c -= 1) < 0;
        }).then(function () {
          expect(c).to.be.below(0);
        });
      });

      it('should be able to repeat the previous test', function () {
        return server.wait(1000, 'until d is negative', function () {
          return (d -= 1) < 0;
        }).then(function () {
          expect(d).to.be.below(0);
        });
      });

      it('should update variable even if wait fails due to timeout', function () {
        return server.wait(200, 'until d is negative', function () {
          return (a -= 5) && false;
        }).catch(function () {
          expect(a).to.be.below(0);
        });
      });

      it('should update variable even if wait fails due to exception', function () {
        return server.wait(200, 'until d is negative', function () {
          if (b < 0) { throw new Error('done') }
          return (b -= 5) && false;
        }).catch(function (err) {
          expect(b).to.be.below(0);
        });
      });

      it.skip('should be able to update closure asynchronously', function () {
        var interval = setInterval(function () { c -= 1 }, 10);
        return server.wait(1000, 'until c is negative', function () {
          return $sync() && c < 0;
        }).always(function () {
          clearInterval(interval);
        });
      });

      it.skip('should be able to alter closure asynchronously', function () {

        wait(1000, 'until c is negative', function () {
          return c < 0;
        }).then(function () {
          a = 1003;
        });

        return server
          .wait(1000, 'until c < 0 && a === 1003', function () {
            return $sync({ c: c - 1 }) && c < 0 && a === 1003;
          }).then(function () {
            expect(c).to.be.below(0);
            expect(a).to.equal(1003);
          });
      });

    });

  });

  // BROWSER

  describe('Closure variables in client scripts', function () {

    var client = browser(server);

    beforeEach(function () {
      b = Math.random().toString();
    });

    describe('Value persitance', function () {

      it('zero value should not be interpreted as undefined', function () {
        return client.execute(function () {
          return zero;
        }).then(function (value) {
          expect(value).to.equal(0);
        });
      });

      it('null variable should equal null', function () {
        return server.execute(function () {
          return v_null;
        }).then(function (value) {
          expect(value).to.equal(null);
        });
      });

      it('undefined variable should be translated to null variable', function () {
        return server.execute(function () {
          return v_undefined;
        }).then(function (value) {
          expect(value).to.equal(null);
        });
      });

    });

    describe('When using client.execute', function () {

      it('should be able to access a closure variable', function () {
        return client.execute(function () {
          return a;
        }).then(function (value) {
          expect(value).to.equal(a);
        });
      });

      it('should be able to alter a closure variable', function () {
        return client.execute(function () {
          return a = Math.random();
        }).then(function (value) {
          expect(a).to.equal(value);
        });
      });

      it('even if the code throws', function () {
        return client.execute(function () {
          a = b;
          throw new Error('another fake error')
        }).expectError(function (err) {
          expect(err.message).to.contain('another fake err');
        }).then(function (value) {
          expect(a).to.equal(b);
        });
      });

      it.skip('should be able to update closure with sync routine', function () {
        return client.execute(function () {
          var value = Math.random();
          $sync({ a: value });
          return value;
        }).then(function (value) {
          expect(a).to.equal(value);
        });
      });

      it.skip('should be able to update closure asynchronously with sync routine', function () {
        return client.execute(function () {
          var value = Math.random();
          Meteor.setTimeout(function () {
            $sync({ a: value });
          });
          return value;
        }).then(function (value) {
          return wait(1000, 'until value is updated', function () {
            return a === value;
          });
        });
      });

    });

    describe('When using client.promise', function () {

      beforeEach(function () {
        b = 10;
        c = Math.random().toString();
      });

      it('should be able to access a closure variable', function () {
        return client.promise(function (resolve) {
          setTimeout(function () {
            resolve(b);
          }, 100);
        }).then(function (value) {
          expect(value).to.equal(b);
        });
      });

      it('should be able to alter a closure variable', function () {
        return client.promise(function (resolve) {
          setTimeout(function () {
            resolve(b = Math.random());
          }, 100);
        }).then(function (value) {
          expect(value).to.equal(b);
        });
      });

      it('even if the promise is rejected', function () {
        return client.promise(function (resolve, reject) {
          setTimeout(function () {
            // it's funny but if we don't convert to string we may get some
            // discrepancy resulting from floating point limited precision
            // it's probably worth investigating
            reject(b = Math.random().toString());
          }, 100);
        }).catch(function (err) {
          expect(err.toString()).to.contain(b);
        });
      });

      it('and if the promise code throws', function () {
        return client.promise(function () {
          b = c;
          throw new Error('another fake error')
        }).expectError(function (err) {
          expect(err.message).to.contain('another fake err');
        }).then(function (value) {
          expect(b).to.equal(c);
        });
      });


      it('should be able to alter a closure variable right after calling "resolve"', function () {
        return client.promise(function (resolve) {
          setTimeout(function () {
            var value = Math.random();
            resolve(value);
            b = value;
          }, 100);
        }).then(function (value) {
          expect(value).to.equal(b);
        });
      });

      it.skip('should be able to use sync with promises', function () {
        var handle = setInterval(function () { b -= 1 }, 10);
        return client.promise(function (resolve, reject) {
          var handle2 = Meteor.setInterval(function () {
            if ($sync().b < 0) {
              Meteor.clearInterval(handle2);
              resolve(b);
            }
          }, 10);
        }).then(function (value) {
          expect(b).to.equal(value);
        }).always(function () {
          clearInterval(handle);
        });
      });

    });

    describe('When using client.wait', function () {

      beforeEach(function () {
        a = 10;
        b = 10;
        c = 10;
        d = 10;
      });

      it('should be able to access a closure variable', function () {
        return client.wait(1000, 'until c equals 10', function () {
          return c === 10;
        });
      });

      it('should be able to alter a closure variable', function () {
        return client.wait(1000, 'until c is negative', function () {
          return (c -= 1) < 0;
        }).then(function () {
          expect(c).to.be.below(0);
        });
      });

      it('should be able to repeat the previous test', function () {
        return client.wait(1000, 'until d is negative', function () {
          return (d -= 1) < 0;
        }).then(function () {
          expect(d).to.be.below(0);
        });
      });

      it('should update variable even if wait fails due to timeout', function () {
        return client.wait(200, 'until d is negative', function () {
          return (a -= 5) && false;
        }).catch(function () {
          expect(a).to.be.below(0);
        });
      });

      it('should update variable even if wait fails due to exception', function () {
        return client.wait(200, 'until d is negative', function () {
          if (b < 0) { throw new Error('done') }
          return (b -= 5) && false;
        }).catch(function (err) {
          expect(b).to.be.below(0);
        });
      });

      it.skip('should be able to update closure asynchronously', function () {
        var interval = setInterval(function () { c -= 1 }, 10);
        return client.wait(1000, 'until c is negative', function () {
          return $sync() && c < 0;
        }).always(function () {
          clearInterval(interval);
        });
      });

      it.skip('should be able to alter closure asynchronously', function () {

        wait(1000, 'until c is negative', function () {
          return c < 0;
        }).then(function () {
          a = 1003;
        });

        return client
          .wait(1000, 'until c < 0 && a === 1003', function () {
            return $sync({ c: c - 1 }) && c < 0 && a === 1003;
          }).then(function () {
            expect(c).to.be.below(0);
            expect(a).to.equal(1003);
          });
      });

    });

  });

  describe('Closure hierarchy', function () {
    
    var a2 = 1;
    var b2 = 2;
    var c2 = 3;

    closure(['a2', 'b2', 'c2'], function (expr) { return eval(expr); });

    it('should be able to use the new variables', function () {
      return server.execute(function () {
        return a2 + b2 + c2;
      }).then(function (value) {
        expect(value).to.equal(6);
      });
    });

    it('should be able to access the parent variables as well', function () {
      return server.execute(function () {
        return a + b + c;
      }).then(function (value) {
        expect(value).to.equal(a + b + c);
      });
    });

  });

  describe('Invalid closure variables', function () {
    var f = function () {};

    closure(['f'], function (expr) { return eval(expr); });

    it('should reject an invalid value', function () {
      return server.execute(function () {
        return f;
      }).expectError(function (err) {
        expect(err.message).to.contain('cannot use a function');
      });
    });
  });

});
